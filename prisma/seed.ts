import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.target.count();

  if (count === 0) {
    await prisma.target.create({
      data: {
        name: "Localhost",
        baseUrl: "http://localhost:3000",
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
