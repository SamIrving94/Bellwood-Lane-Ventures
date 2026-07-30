import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';

export type SignedOfferEmailProps = {
  readonly agentFirstName?: string;
  readonly propertyAddress: string;
  readonly offerFormatted: string;
  readonly signedOfferUrl: string;
};

/**
 * Plain, UK English, 3 short paragraphs. Goes to the introducing agent
 * with the signed binding PDF linked. No emoji.
 */
export const SignedOfferEmail = ({
  agentFirstName,
  propertyAddress,
  offerFormatted,
  signedOfferUrl,
}: SignedOfferEmailProps) => (
  <Tailwind>
    <Html>
      <Head />
      <Preview>Signed binding offer for {propertyAddress}</Preview>
      <Body className="bg-[#f7f3ea] font-sans">
        <Container className="mx-auto py-12">
          <Section className="rounded-md bg-white p-8">
            <Heading className="mt-0 mb-4 font-semibold text-[#1f332b] text-xl">
              {agentFirstName ? `Hi ${agentFirstName},` : 'Hello,'}
            </Heading>

            <Text className="text-[#4c5a50]">
              Attached is our signed binding offer for {propertyAddress} at{' '}
              {offerFormatted}.
            </Text>

            <Text className="text-[#4c5a50]">
              Walk-away cover of £1,000 applies if anything changes our side
              after acceptance. Subject only to the carve-outs in the letter,
              this is firm cash, no chain, no finance condition.
            </Text>

            <Text className="text-[#4c5a50]">
              Reply if anything needs adjusting and we will respond before the
              next working day.
            </Text>

            <Section className="my-6">
              <Link
                href={signedOfferUrl}
                className="rounded-full bg-[#2e7d5b] px-5 py-3 font-medium text-white"
              >
                Open signed PDF
              </Link>
            </Section>

            <Hr className="my-6" />

            <Text className="text-[#4c5a50] text-sm">
              Sam — Bellwood Ventures
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  </Tailwind>
);

const ExampleSignedOffer = () => (
  <SignedOfferEmail
    agentFirstName="Alex"
    propertyAddress="14 Acacia Avenue, M14 5XJ"
    offerFormatted="£182,500"
    signedOfferUrl="https://example.com/offer.pdf"
  />
);

export default ExampleSignedOffer;
