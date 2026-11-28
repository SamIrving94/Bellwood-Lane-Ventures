/**
 * Reads the SQL script that `prisma migrate diff --script` prints and sorts
 * every step into one of three piles: it ADDS something, it DELETES
 * something, or it CHANGES something that is already there.
 *
 * Why this exists. Every branch pushes its schema to the same live database,
 * and `prisma db push` makes the database match ONE schema. A table that only
 * another, unmerged branch knows about looks like a leftover, so it is
 * dropped, and with no warning at all while it is still empty. 26 to 28 Nov
 * 2026: master wanted to drop `EmailMessage` (an open PR's table), that PR
 * wanted to drop `DealEmail` (live code's table), and a day later both wanted
 * to drop `QuoteRequestSource`.
 *
 * Pure on purpose: text in, plan out. No database, no Prisma, no files. The
 * judgement that guards the live database can then be tested on its own,
 * against scripts Prisma really printed.
 *
 * It fails closed. A step it does not recognise that mentions DROP TABLE,
 * DROP COLUMN, DROP TYPE, TRUNCATE or DELETE FROM counts as a deletion, and
 * nothing it does not fully understand is ever offered as safe to add.
 */

const WINDOWS_LINE_ENDINGS = /\r\n/g;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
// Prisma heads each step with its kind: `-- CreateTable`, `-- DropEnum`.
// One CamelCase word, so its prose comments ("-- This migration adds more
// than one value...") are not mistaken for the start of a step.
const KIND_HEADER = /^-- [A-Z][A-Za-z]+$/;
const COMMENT_LINE = /^\s*--/;
const QUOTED_NAME = /"[^"]*"/g;
const QUOTED_TEXT = /'(?:[^']|'')*'/g;
const SEMICOLON = /;/g;
const DESTRUCTIVE =
  /\b(?:DROP\s+(?:TABLE|COLUMN|TYPE|SCHEMA|DATABASE)|TRUNCATE|DELETE\s+FROM)\b/i;

const CREATE_TABLE = /^CREATE TABLE "([^"]+)" \(/;
const CREATE_TYPE = /^CREATE TYPE "([^"]+)" AS ENUM /;
const CREATE_INDEX = /^CREATE (?:UNIQUE )?INDEX "([^"]+)" ON "([^"]+)"/;
const DROP_TABLE = /^DROP TABLE "([^"]+)";$/;
const DROP_TYPE = /^DROP TYPE "([^"]+)";$/;
const DROP_INDEX = /^DROP INDEX "([^"]+)";$/;
// Removing a value from an enum: Prisma builds a new type, moves the columns
// over, and drops the old one, all inside BEGIN ... COMMIT.
const ENUM_REBUILD =
  /^BEGIN;[\s\S]*ALTER TYPE "([^"]+)" RENAME TO "[^"]+_old";/;
const ADD_ENUM_VALUE = /^ALTER TYPE "([^"]+)" ADD VALUE ('(?:[^']|'')*');$/;
const ALTER_TABLE = /^ALTER TABLE "([^"]+)" ([\s\S]*);$/;
// Prisma writes one clause per line: `DROP COLUMN "a",\nADD COLUMN "b" TEXT`.
const CLAUSE_BREAK = /,\n/;
const ADD_COLUMN = /^ADD COLUMN\s+"([^"]+)"/;
const DROP_COLUMN = /^DROP COLUMN\s+"([^"]+)"$/;
const ALTER_COLUMN = /^ALTER COLUMN\s+"([^"]+)"/;

/**
 * @typedef {object} Step
 * @property {string[]} adds     plain-word names of what the step adds
 * @property {string[]} deletes  plain-word names of what the step deletes
 * @property {string[]} changes  plain-word names of what the step alters
 * @property {string} addSql     SQL that does only the adding, or ''
 */

/** @returns {Step} */
const step = ({ adds = [], deletes = [], changes = [], addSql = '' }) => ({
  adds,
  deletes,
  changes,
  addSql,
});

/** The SQL with every name and string blanked, so only keywords are left. */
const keywordsOnly = (sql) =>
  sql.replace(QUOTED_TEXT, "''").replace(QUOTED_NAME, '""');

const isDestructive = (sql) => DESTRUCTIVE.test(keywordsOnly(sql));

const isOneStatement = (sql) =>
  sql.endsWith(';') && (keywordsOnly(sql).match(SEMICOLON) ?? []).length === 1;

/** Splits the script into the SQL of each step, comments removed. */
const readSteps = (script) => {
  const lines = script
    .replace(WINDOWS_LINE_ENDINGS, '\n')
    .replace(BLOCK_COMMENT, '')
    .split('\n');
  const blocks = [[]];
  for (const line of lines) {
    if (KIND_HEADER.test(line)) {
      blocks.push([]);
    } else if (!COMMENT_LINE.test(line)) {
      blocks.at(-1)?.push(line);
    }
  }
  return blocks.map((block) => block.join('\n').trim()).filter(Boolean);
};

/** CREATE TABLE / TYPE / INDEX: something new, nothing existing touched. */
const createStep = (sql) => {
  if (!isOneStatement(sql)) {
    return null;
  }
  const table = sql.match(CREATE_TABLE);
  if (table) {
    return step({ adds: [`table "${table[1]}"`], addSql: sql });
  }
  const type = sql.match(CREATE_TYPE);
  if (type) {
    return step({ adds: [`type "${type[1]}"`], addSql: sql });
  }
  const index = sql.match(CREATE_INDEX);
  if (index) {
    return step({
      adds: [`index "${index[1]}" on table "${index[2]}"`],
      addSql: sql,
    });
  }
  return null;
};

const dropStep = (sql) => {
  const table = sql.match(DROP_TABLE);
  if (table) {
    return step({ deletes: [`table "${table[1]}"`] });
  }
  const type = sql.match(DROP_TYPE);
  if (type) {
    return step({ deletes: [`type "${type[1]}"`] });
  }
  // An index holds no data of its own, so losing one is a change, not a
  // deletion. It is still left alone in add-only mode.
  const index = sql.match(DROP_INDEX);
  if (index) {
    return step({ changes: [`index "${index[1]}" (removed)`] });
  }
  return null;
};

const enumStep = (sql) => {
  const rebuilt = sql.match(ENUM_REBUILD);
  if (rebuilt) {
    return step({ deletes: [`one or more values of type "${rebuilt[1]}"`] });
  }
  const lines = sql.split('\n').filter((line) => line.trim() !== '');
  const values = lines.map((line) => line.match(ADD_ENUM_VALUE));
  if (values.length > 0 && values.every(Boolean)) {
    return step({
      adds: values.map((value) => `value ${value[2]} in type "${value[1]}"`),
      addSql: sql,
    });
  }
  return null;
};

/** One clause of an ALTER TABLE, sorted into its pile. */
const readClause = (table, clause) => {
  const add = clause.match(ADD_COLUMN);
  if (add) {
    return { pile: 'adds', name: `column "${add[1]}" in table "${table}"` };
  }
  const drop = clause.match(DROP_COLUMN);
  if (drop) {
    return { pile: 'deletes', name: `column "${drop[1]}" in table "${table}"` };
  }
  const alter = clause.match(ALTER_COLUMN);
  if (alter) {
    return {
      pile: 'changes',
      name: `column "${alter[1]}" in table "${table}" (changed)`,
    };
  }
  return null;
};

/**
 * ALTER TABLE can add, drop and alter columns in one statement. Two branches
 * that each add a column to the same table see exactly that: their own
 * column as ADD, the other branch's as DROP. So the ADD clauses are lifted
 * out into a statement of their own, which is all add-only mode will run.
 */
const alterTableStep = (sql) => {
  const match = sql.match(ALTER_TABLE);
  if (!(match && isOneStatement(sql))) {
    return null;
  }
  const [, table, body] = match;
  const clauses = body.split(CLAUSE_BREAK).map((clause) => clause.trim());
  const read = clauses.map((clause) => readClause(table, clause));
  if (!read.every(Boolean)) {
    // A clause this tool cannot read. Nothing in the statement is offered
    // as safe; unknownStep decides whether it counts as a deletion.
    return null;
  }
  const pile = (name) =>
    read.filter((clause) => clause.pile === name).map((clause) => clause.name);
  const addClauses = clauses.filter((clause) => ADD_COLUMN.test(clause));
  return step({
    adds: pile('adds'),
    deletes: pile('deletes'),
    changes: pile('changes'),
    addSql:
      addClauses.length > 0
        ? `ALTER TABLE "${table}" ${addClauses.join(',\n')};`
        : '',
  });
};

const unknownStep = (sql) => {
  const firstLine = sql.split('\n')[0];
  return isDestructive(sql)
    ? step({ deletes: [`something not recognised: ${firstLine}`] })
    : step({ changes: [`something not recognised: ${firstLine}`] });
};

/** @returns {Step} */
const judge = (sql) => {
  const found =
    createStep(sql) ??
    dropStep(sql) ??
    enumStep(sql) ??
    alterTableStep(sql) ??
    unknownStep(sql);
  // Belt and braces: whatever the reading above concluded, SQL offered as
  // "only adds" must not contain a deletion.
  if (found.addSql !== '' && isDestructive(found.addSql)) {
    return unknownStep(sql);
  }
  return found;
};

/**
 * @typedef {object} MigrationPlan
 * @property {boolean} empty     the database already matches the schema
 * @property {string[]} adds     everything that would be added
 * @property {string[]} deletes  everything that would be deleted
 * @property {string[]} changes  everything else that would be altered
 * @property {string} addSql     SQL that adds everything in `adds` and does
 *                               nothing else; '' when there is nothing to add
 */

/**
 * @param {string} script output of `prisma migrate diff --script`
 * @returns {MigrationPlan}
 */
export function planMigration(script) {
  const steps = readSteps(script).map(judge);
  return {
    empty: steps.length === 0,
    adds: steps.flatMap((found) => found.adds),
    deletes: steps.flatMap((found) => found.deletes),
    changes: steps.flatMap((found) => found.changes),
    addSql: steps
      .map((found) => found.addSql)
      .filter(Boolean)
      .join('\n\n'),
  };
}
