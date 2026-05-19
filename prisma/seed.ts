import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const games = [
  {
    slug: "the-last-curtain",
    title: "The Last Curtain",
    tagline: "A murder at opening night of an elite theater company.",
    description:
      "A theatrical murder mystery for ambitious hosts who want suspense, hidden agendas, and a shocking final reveal.",
    minPlayers: 6,
    maxPlayers: 12,
    durationMin: 120,
    durationMax: 180,
    themes: ["Theater", "Secrets", "Revenge"],
    characters: [
      {
        key: "director",
        name: "Vivian Vale",
        publicBio: "The theater company's exacting director, known for brilliant productions and impossible standards.",
        isRequired: true,
        sortOrder: 1
      },
      {
        key: "leading-actor",
        name: "Dorian Cross",
        publicBio: "A charismatic lead actor whose opening-night confidence hides old professional grudges.",
        isRequired: true,
        sortOrder: 2
      },
      {
        key: "stage-manager",
        name: "Mara Finch",
        publicBio: "The stage manager who knows every entrance, prop, schedule change, and backstage secret.",
        isRequired: true,
        sortOrder: 3
      },
      {
        key: "critic",
        name: "Elliot Voss",
        publicBio: "A feared arts critic whose reviews can make or destroy a career overnight.",
        isRequired: true,
        sortOrder: 4
      },
      {
        key: "producer",
        name: "Celeste Monroe",
        publicBio: "The money behind the production, balancing glamour, debt, and public reputation.",
        isRequired: false,
        sortOrder: 5
      },
      {
        key: "understudy",
        name: "Kit Mercer",
        publicBio: "An ambitious understudy waiting for the one chance that could change everything.",
        isRequired: false,
        sortOrder: 6
      }
    ],
    rounds: [
      {
        key: "round-1",
        title: "Round 1: Pre-Murder Interaction",
        summary: "Opening-night mingling before the murder occurs.",
        sortOrder: 1,
        cards: [
          {
            key: "round-1-public",
            title: "Opening Night Begins",
            body: "Guests arrive, trade greetings, and begin surfacing old tensions around the production.",
            visibility: "PUBLIC",
            sortOrder: 1
          },
          {
            key: "round-1-host-safe",
            title: "Host-Safe Round 1 Note",
            body: "Keep victim and killer information locked. This round is for public suspicion and character setup only.",
            visibility: "HOST_SAFE",
            sortOrder: 2
          },
          {
            key: "director-round-1-private",
            characterKey: "director",
            title: "Private Objective",
            body: "Find out who has been criticizing your leadership before the curtain rises.",
            visibility: "PLAYER_PRIVATE",
            sortOrder: 3
          }
        ]
      },
      {
        key: "round-2",
        title: "Round 2: Murder and Investigation",
        summary: "The murder occurs and players begin comparing evidence.",
        sortOrder: 2,
        cards: [
          {
            key: "round-2-public",
            title: "The Show Stops",
            body: "The murder has been discovered. Players may now discuss suspicious movements and contradictions.",
            visibility: "PUBLIC",
            sortOrder: 1
          },
          {
            key: "round-2-host-safe",
            title: "Host-Safe Investigation Note",
            body: "Reveal only investigation-safe clues. Do not expose the final solution or killer knowledge yet.",
            visibility: "HOST_SAFE",
            sortOrder: 2
          },
          {
            key: "stage-manager-round-2-private",
            characterKey: "stage-manager",
            title: "Private Clue",
            body: "You noticed a prop was moved before anyone admitted entering backstage.",
            visibility: "PLAYER_PRIVATE",
            sortOrder: 3
          }
        ]
      },
      {
        key: "round-3",
        title: "Round 3: Accusation and Final Reveal",
        summary: "Players make accusations before the final solution is revealed.",
        sortOrder: 3,
        cards: [
          {
            key: "round-3-public",
            title: "Make Your Accusation",
            body: "Each player should name a suspect, motive, and key piece of evidence before the reveal.",
            visibility: "PUBLIC",
            sortOrder: 1
          },
          {
            key: "round-3-final-reveal",
            title: "Final Reveal Placeholder",
            body: "Spoiler-protected final solution content belongs here and must remain locked until the host reveals it.",
            visibility: "SPOILER_PROTECTED",
            sortOrder: 2
          }
        ]
      }
    ],
    evidence: [
      {
        key: "playbill-note",
        roundKey: "round-1",
        title: "Annotated Playbill",
        body: "A playbill has several cast names circled in red pencil, with a note in the margin: 'Opening night will settle everything.'",
        evidenceType: "DOCUMENT",
        visibility: "PUBLIC",
        sortOrder: 1
      },
      {
        key: "backstage-call-sheet",
        roundKey: "round-2",
        characterKey: "stage-manager",
        title: "Backstage Call Sheet",
        body: "The call sheet shows one backstage access window that does not match the public timeline.",
        evidenceType: "DOCUMENT",
        visibility: "PLAYER_PRIVATE",
        sortOrder: 2
      },
      {
        key: "host-prop-note",
        roundKey: "round-2",
        title: "Host Note: Prop Table",
        body: "This evidence helps the host steer investigation toward the prop table without naming the killer.",
        evidenceType: "NOTE",
        visibility: "HOST_SAFE",
        sortOrder: 3
      },
      {
        key: "final-confession",
        roundKey: "round-3",
        title: "Final Confession",
        body: "Spoiler-protected solution evidence. Keep locked until the final reveal control exists.",
        evidenceType: "DOCUMENT",
        visibility: "SPOILER_PROTECTED",
        sortOrder: 4
      }
    ],
    finalReveal: {
      title: "The Last Curtain: Final Reveal",
      victimCharacterKey: "critic",
      killerCharacterKey: "understudy",
      victimRevealText:
        "Elliot Voss, the feared critic, is the victim. His final review threatened to expose years of backstage sabotage.",
      killerRevealText:
        "Kit Mercer is the killer. The understudy used opening night chaos to frame the company while clearing a path to the spotlight.",
      solutionText:
        "The moved prop, the altered call sheet, and the circled playbill all point to Kit. Kit knew the backstage timing well enough to create an impossible window, then let old grudges make everyone else look guilty.",
      epilogueText:
        "The production survives, but opening night becomes infamous. Every player should reveal the secret they protected most carefully."
    },
    media: [
      {
        key: "playbill-image",
        roundKey: "round-1",
        evidenceKey: "playbill-note",
        title: "Playbill Image",
        description: "A player-safe image version of the annotated playbill.",
        assetType: "IMAGE",
        url: "/media/the-last-curtain-playbill.svg",
        mimeType: "image/svg+xml",
        visibility: "PUBLIC",
        sortOrder: 1
      },
      {
        key: "stage-manager-note",
        roundKey: "round-2",
        characterKey: "stage-manager",
        evidenceKey: "backstage-call-sheet",
        title: "Stage Manager Note",
        description: "A private document-style clue for the stage manager.",
        assetType: "DOCUMENT",
        url: "/media/stage-manager-note.txt",
        mimeType: "text/plain",
        visibility: "PLAYER_PRIVATE",
        sortOrder: 2
      }
    ],
    product: {
      slug: "the-last-curtain-digital-host-kit",
      name: "The Last Curtain Digital Host Kit",
      priceCents: 2999
    }
  },
  {
    slug: "murder-at-hollow-lake",
    title: "Murder at Hollow Lake",
    tagline: "A weekend retreat turns deadly on a secluded lake estate.",
    description: "A weekend lakehouse gathering turns dangerous when old debts and secrets resurface.",
    minPlayers: 5,
    maxPlayers: 10,
    durationMin: 120,
    durationMax: 180,
    themes: ["Retreat", "Mystery", "Legacy"],
    characters: [
      {
        key: "host-heir",
        name: "Harper Vale",
        publicBio: "The lake estate heir trying to keep the weekend civil while family history resurfaces.",
        isRequired: true,
        sortOrder: 1
      },
      {
        key: "old-friend",
        name: "Miles Arden",
        publicBio: "A charming old friend with a long memory and reasons to revisit the past.",
        isRequired: true,
        sortOrder: 2
      },
      {
        key: "caretaker",
        name: "June Calder",
        publicBio: "The estate caretaker who knows the shoreline, the house, and who arrived before they claimed.",
        isRequired: true,
        sortOrder: 3
      },
      {
        key: "business-partner",
        name: "Sloane Pierce",
        publicBio: "A business partner whose calm exterior masks pressure from a failing deal.",
        isRequired: true,
        sortOrder: 4
      },
      {
        key: "documentarian",
        name: "Rowan Blake",
        publicBio: "A documentarian collecting stories about the lake estate's uneasy legacy.",
        isRequired: false,
        sortOrder: 5
      },
      {
        key: "neighbor",
        name: "Tessa Wren",
        publicBio: "A nearby resident with sharp eyes, local rumors, and a complicated history with the estate.",
        isRequired: false,
        sortOrder: 6
      }
    ],
    rounds: [
      {
        key: "round-1",
        title: "Round 1: Pre-Murder Interaction",
        summary: "The weekend retreat begins and old lake-estate tensions surface.",
        sortOrder: 1,
        cards: [
          {
            key: "round-1-public",
            title: "Arrival at Hollow Lake",
            body: "Guests arrive at the secluded estate and begin reconnecting under strained circumstances.",
            visibility: "PUBLIC",
            sortOrder: 1
          },
          {
            key: "round-1-host-safe",
            title: "Host-Safe Round 1 Note",
            body: "Keep the murder, victim, killer, and final reveal locked. This round establishes motive and history.",
            visibility: "HOST_SAFE",
            sortOrder: 2
          },
          {
            key: "host-heir-round-1-private",
            characterKey: "host-heir",
            title: "Private Objective",
            body: "Find out who has been asking questions about the estate records.",
            visibility: "PLAYER_PRIVATE",
            sortOrder: 3
          }
        ]
      },
      {
        key: "round-2",
        title: "Round 2: Murder and Investigation",
        summary: "The murder is discovered and players begin investigating the estate.",
        sortOrder: 2,
        cards: [
          {
            key: "round-2-public",
            title: "A Body by the Lake",
            body: "The murder has occurred. Players may now investigate timelines, alibis, and discovered evidence.",
            visibility: "PUBLIC",
            sortOrder: 1
          },
          {
            key: "round-2-host-safe",
            title: "Host-Safe Investigation Note",
            body: "Reveal investigation clues only. Keep the final culprit and solution locked until Round 3.",
            visibility: "HOST_SAFE",
            sortOrder: 2
          },
          {
            key: "caretaker-round-2-private",
            characterKey: "caretaker",
            title: "Private Clue",
            body: "You saw fresh footprints near a service path that most guests do not know exists.",
            visibility: "PLAYER_PRIVATE",
            sortOrder: 3
          }
        ]
      },
      {
        key: "round-3",
        title: "Round 3: Accusation and Final Reveal",
        summary: "Players make accusations before the final solution is revealed.",
        sortOrder: 3,
        cards: [
          {
            key: "round-3-public",
            title: "Final Accusations",
            body: "Each player should name a suspect, motive, and evidence trail before the reveal.",
            visibility: "PUBLIC",
            sortOrder: 1
          },
          {
            key: "round-3-final-reveal",
            title: "Final Reveal Placeholder",
            body: "Spoiler-protected solution content belongs here and should unlock only when the host chooses final reveal.",
            visibility: "SPOILER_PROTECTED",
            sortOrder: 2
          }
        ]
      }
    ],
    evidence: [
      {
        key: "estate-map",
        roundKey: "round-1",
        title: "Marked Estate Map",
        body: "An old estate map shows a service path from the house to the shoreline that most guests do not mention.",
        evidenceType: "DOCUMENT",
        visibility: "PUBLIC",
        sortOrder: 1
      },
      {
        key: "shoreline-footprints",
        roundKey: "round-2",
        characterKey: "caretaker",
        title: "Shoreline Footprints",
        body: "Fresh footprints near the service path suggest someone knew a quiet route to the lake.",
        evidenceType: "IMAGE",
        visibility: "PLAYER_PRIVATE",
        sortOrder: 2
      },
      {
        key: "host-timeline-note",
        roundKey: "round-2",
        title: "Host Note: Timeline Pressure",
        body: "Use this clue to press players on arrival times without revealing the final solution.",
        evidenceType: "NOTE",
        visibility: "HOST_SAFE",
        sortOrder: 3
      },
      {
        key: "sealed-letter",
        roundKey: "round-3",
        title: "Sealed Letter",
        body: "Spoiler-protected final evidence. This should remain hidden until the solution is unlocked.",
        evidenceType: "DOCUMENT",
        visibility: "SPOILER_PROTECTED",
        sortOrder: 4
      }
    ],
    finalReveal: {
      title: "Murder at Hollow Lake: Final Reveal",
      victimCharacterKey: "old-friend",
      killerCharacterKey: "business-partner",
      victimRevealText:
        "Miles Arden is the victim. His return to Hollow Lake threatened to expose a buried estate secret.",
      killerRevealText:
        "Sloane Pierce is the killer. The failing deal, hidden route, and shoreline timeline gave Sloane motive and opportunity.",
      solutionText:
        "The estate map and service-path evidence prove the killer knew how to reach the shoreline unseen. Sloane used the retreat's old tensions to distract everyone while protecting a collapsing business arrangement.",
      epilogueText:
        "Hollow Lake keeps its reputation, but not its silence. Each player should reveal what they were hiding from the rest of the party."
    },
    media: [
      {
        key: "estate-map-image",
        roundKey: "round-1",
        evidenceKey: "estate-map",
        title: "Estate Map Image",
        description: "A player-safe estate map image for Hollow Lake.",
        assetType: "IMAGE",
        url: "/media/hollow-lake-map.svg",
        mimeType: "image/svg+xml",
        visibility: "PUBLIC",
        sortOrder: 1
      },
      {
        key: "caretaker-note",
        roundKey: "round-2",
        characterKey: "caretaker",
        evidenceKey: "shoreline-footprints",
        title: "Caretaker Footprint Note",
        description: "A private document clue for the caretaker.",
        assetType: "DOCUMENT",
        url: "/media/caretaker-footprint-note.txt",
        mimeType: "text/plain",
        visibility: "PLAYER_PRIVATE",
        sortOrder: 2
      }
    ],
    product: {
      slug: "murder-at-hollow-lake-digital-host-kit",
      name: "Murder at Hollow Lake Digital Host Kit",
      priceCents: 2999
    }
  }
];

async function main() {
  for (const gameSeed of games) {
    const game = await prisma.game.upsert({
      where: { slug: gameSeed.slug },
      update: {
        title: gameSeed.title,
        tagline: gameSeed.tagline,
        description: gameSeed.description,
        minPlayers: gameSeed.minPlayers,
        maxPlayers: gameSeed.maxPlayers,
        durationMin: gameSeed.durationMin,
        durationMax: gameSeed.durationMax,
        status: "PUBLISHED"
      },
      create: {
        slug: gameSeed.slug,
        title: gameSeed.title,
        tagline: gameSeed.tagline,
        description: gameSeed.description,
        minPlayers: gameSeed.minPlayers,
        maxPlayers: gameSeed.maxPlayers,
        durationMin: gameSeed.durationMin,
        durationMax: gameSeed.durationMax,
        status: "PUBLISHED"
      }
    });

    const version = await prisma.gameVersion.upsert({
      where: {
        gameId_versionNumber: {
          gameId: game.id,
          versionNumber: 1
        }
      },
      update: {
        status: "PUBLISHED",
        themes: gameSeed.themes,
        publishedAt: new Date()
      },
      create: {
        gameId: game.id,
        versionNumber: 1,
        status: "PUBLISHED",
        themes: gameSeed.themes,
        publishedAt: new Date()
      }
    });

    const characterByKey = new Map<string, string>();
    for (const character of gameSeed.characters) {
      const savedCharacter = await prisma.gameCharacter.upsert({
        where: {
          gameVersionId_key: {
            gameVersionId: version.id,
            key: character.key
          }
        },
        update: {
          name: character.name,
          publicBio: character.publicBio,
          isRequired: character.isRequired,
          sortOrder: character.sortOrder
        },
        create: {
          gameVersionId: version.id,
          key: character.key,
          name: character.name,
          publicBio: character.publicBio,
          isRequired: character.isRequired,
          sortOrder: character.sortOrder
        }
      });
      characterByKey.set(character.key, savedCharacter.id);
    }

    const roundByKey = new Map<string, string>();
    for (const roundSeed of gameSeed.rounds) {
      const round = await prisma.gameRound.upsert({
        where: {
          gameVersionId_key: {
            gameVersionId: version.id,
            key: roundSeed.key
          }
        },
        update: {
          title: roundSeed.title,
          summary: roundSeed.summary,
          sortOrder: roundSeed.sortOrder
        },
        create: {
          gameVersionId: version.id,
          key: roundSeed.key,
          title: roundSeed.title,
          summary: roundSeed.summary,
          sortOrder: roundSeed.sortOrder
        }
      });
      roundByKey.set(roundSeed.key, round.id);

      for (const card of roundSeed.cards) {
        const characterId =
          "characterKey" in card && typeof card.characterKey === "string"
            ? characterByKey.get(card.characterKey)
            : undefined;
        await prisma.gameCard.upsert({
          where: {
            gameRoundId_key: {
              gameRoundId: round.id,
              key: card.key
            }
          },
          update: {
            characterId,
            title: card.title,
            body: card.body,
            visibility: card.visibility,
            sortOrder: card.sortOrder
          },
          create: {
            gameRoundId: round.id,
            characterId,
            key: card.key,
            title: card.title,
            body: card.body,
            visibility: card.visibility,
            sortOrder: card.sortOrder
          }
        });
      }
    }

    const evidenceByKey = new Map<string, string>();
    for (const evidence of gameSeed.evidence) {
      const characterId =
        "characterKey" in evidence && typeof evidence.characterKey === "string"
          ? characterByKey.get(evidence.characterKey)
          : undefined;
      const gameRoundId =
        "roundKey" in evidence && typeof evidence.roundKey === "string"
          ? roundByKey.get(evidence.roundKey)
          : undefined;

      const savedEvidence = await prisma.gameEvidence.upsert({
        where: {
          gameVersionId_key: {
            gameVersionId: version.id,
            key: evidence.key
          }
        },
        update: {
          gameRoundId,
          characterId,
          title: evidence.title,
          body: evidence.body,
          evidenceType: evidence.evidenceType,
          visibility: evidence.visibility,
          sortOrder: evidence.sortOrder
        },
        create: {
          gameVersionId: version.id,
          gameRoundId,
          characterId,
          key: evidence.key,
          title: evidence.title,
          body: evidence.body,
          evidenceType: evidence.evidenceType,
          visibility: evidence.visibility,
          sortOrder: evidence.sortOrder
        }
      });
      evidenceByKey.set(evidence.key, savedEvidence.id);
    }

    const finalReveal = await prisma.gameFinalReveal.upsert({
      where: {
        gameVersionId: version.id
      },
      update: {
        victimCharacterId: characterByKey.get(gameSeed.finalReveal.victimCharacterKey),
        killerCharacterId: characterByKey.get(gameSeed.finalReveal.killerCharacterKey),
        title: gameSeed.finalReveal.title,
        victimRevealText: gameSeed.finalReveal.victimRevealText,
        killerRevealText: gameSeed.finalReveal.killerRevealText,
        solutionText: gameSeed.finalReveal.solutionText,
        epilogueText: gameSeed.finalReveal.epilogueText
      },
      create: {
        gameVersionId: version.id,
        victimCharacterId: characterByKey.get(gameSeed.finalReveal.victimCharacterKey),
        killerCharacterId: characterByKey.get(gameSeed.finalReveal.killerCharacterKey),
        title: gameSeed.finalReveal.title,
        victimRevealText: gameSeed.finalReveal.victimRevealText,
        killerRevealText: gameSeed.finalReveal.killerRevealText,
        solutionText: gameSeed.finalReveal.solutionText,
        epilogueText: gameSeed.finalReveal.epilogueText
      }
    });

    const existingParties = await prisma.party.findMany({
      where: { gameVersionId: version.id },
      select: { id: true }
    });

    for (const party of existingParties) {
      await prisma.partyFinalRevealState.upsert({
        where: { partyId: party.id },
        update: {
          finalRevealId: finalReveal.id
        },
        create: {
          partyId: party.id,
          finalRevealId: finalReveal.id
        }
      });
    }

    for (const media of gameSeed.media) {
      const characterId =
        "characterKey" in media && typeof media.characterKey === "string"
          ? characterByKey.get(media.characterKey)
          : undefined;
      const gameRoundId =
        "roundKey" in media && typeof media.roundKey === "string"
          ? roundByKey.get(media.roundKey)
          : undefined;
      const evidenceId =
        "evidenceKey" in media && typeof media.evidenceKey === "string"
          ? evidenceByKey.get(media.evidenceKey)
          : undefined;

      await prisma.gameMediaAsset.upsert({
        where: {
          gameVersionId_key: {
            gameVersionId: version.id,
            key: media.key
          }
        },
        update: {
          gameRoundId,
          characterId,
          evidenceId,
          title: media.title,
          description: media.description,
          assetType: media.assetType,
          url: media.url,
          mimeType: media.mimeType,
          visibility: media.visibility,
          sortOrder: media.sortOrder
        },
        create: {
          gameVersionId: version.id,
          gameRoundId,
          characterId,
          evidenceId,
          key: media.key,
          title: media.title,
          description: media.description,
          assetType: media.assetType,
          url: media.url,
          mimeType: media.mimeType,
          visibility: media.visibility,
          sortOrder: media.sortOrder
        }
      });
    }

    await prisma.product.upsert({
      where: { slug: gameSeed.product.slug },
      update: {
        gameId: game.id,
        name: gameSeed.product.name,
        priceCents: gameSeed.product.priceCents,
        currency: "USD",
        status: "ACTIVE"
      },
      create: {
        gameId: game.id,
        slug: gameSeed.product.slug,
        name: gameSeed.product.name,
        priceCents: gameSeed.product.priceCents,
        currency: "USD",
        status: "ACTIVE"
      }
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
