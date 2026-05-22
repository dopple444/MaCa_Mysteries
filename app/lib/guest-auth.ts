import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "./prisma";

const GUEST_COOKIE = "maca_guest";
const GUEST_DAYS = 14;

export async function createGuestSession(guestToken: string) {
  const expiresAt = new Date(Date.now() + GUEST_DAYS * 24 * 60 * 60 * 1000);
  const cookieStore = await cookies();

  cookieStore.set(GUEST_COOKIE, guestToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export async function getCurrentGuest() {
  const cookieStore = await cookies();
  const guestToken = cookieStore.get(GUEST_COOKIE)?.value;
  if (!guestToken) return null;

  const guest = await prisma.guest.findUnique({
    where: { guestToken },
    include: {
      assignments: {
        include: {
          character: true
        }
      },
      party: {
        include: {
          game: true,
          gameVersion: {
            include: {
              characters: {
                orderBy: [
                  { isRequired: "desc" },
                  { sortOrder: "asc" },
                  { name: "asc" }
                ]
              },
              mediaAssets: {
                orderBy: [
                  { sortOrder: "asc" },
                  { title: "asc" }
                ]
              },
              digitalArtifacts: {
                orderBy: [
                  { sortOrder: "asc" },
                  { title: "asc" }
                ],
                include: {
                  gameRound: true,
                  evidence: true,
                  mediaAsset: true
                }
              }
            }
          },
          roundStates: {
            include: {
              gameRound: {
                include: {
                  cards: {
                    orderBy: [
                      { sortOrder: "asc" },
                      { title: "asc" }
                    ]
                  }
                }
              }
            }
          },
          evidenceReveals: {
            include: {
              evidence: {
                include: {
                  gameRound: true
                }
              }
            },
            orderBy: {
              revealedAt: "asc"
            }
          },
          accusations: {
            where: {
              guest: {
                guestToken
              }
            }
          },
          unlockEvents: true,
          finalRevealState: {
            include: {
              finalReveal: {
                include: {
                  victimCharacter: true,
                  killerCharacter: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!guest) return null;

  return guest;
}

export async function requireGuest() {
  const guest = await getCurrentGuest();
  if (!guest) redirect("/join");
  return guest;
}
