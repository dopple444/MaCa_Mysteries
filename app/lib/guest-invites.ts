export type GuestInvite = {
  name: string;
  email: string;
};

function parseGuestLines(input: string) {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseGuestInvite(input: string): GuestInvite {
  const [namePart, emailPart] = input.split(",").map((item) => item.trim());
  const name = emailPart ? namePart : "";
  const email = emailPart ?? namePart;

  return { name: name || email, email: email.toLowerCase() };
}

export function parseGuestInvites(input: string): GuestInvite[] {
  return parseGuestLines(input).flatMap((line) => {
    const parts = line
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (parts.length === 2 && !parts[0].includes("@") && parts[1].includes("@")) {
      return [parseGuestInvite(line)];
    }

    return parts
      .filter((email) => email.includes("@"))
      .map((email) => ({ name: email, email: email.toLowerCase() }));
  });
}
