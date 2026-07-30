import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';

type ContactTemplateProps = {
  readonly name: string;
  readonly email: string;
  readonly message: string;
};

export const ContactTemplate = ({
  name,
  email,
  message,
}: ContactTemplateProps) => (
  <Tailwind>
    <Html>
      <Head />
      <Preview>New email from {name}</Preview>
      <Body className="bg-[#f7f3ea] font-sans">
        <Container className="mx-auto py-12">
          <Section className="mt-8 rounded-md bg-[#e2dccb] p-px">
            <Section className="rounded-[5px] bg-white p-8">
              <Text className="mt-0 mb-4 font-semibold text-2xl text-[#1f332b]">
                New email from {name}
              </Text>
              <Text className="m-0 text-[#4c5a50]">
                {name} ({email}) has sent you a message:
              </Text>
              <Hr className="my-4" />
              <Text className="m-0 text-[#4c5a50]">{message}</Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  </Tailwind>
);

const ExampleContactEmail = () => (
  <ContactTemplate
    name="Jane Smith"
    email="jane@example.com"
    message="Hello, how do I get started?"
  />
);

export default ExampleContactEmail;
