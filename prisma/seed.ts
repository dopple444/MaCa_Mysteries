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

    await prisma.gameVersion.upsert({
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
