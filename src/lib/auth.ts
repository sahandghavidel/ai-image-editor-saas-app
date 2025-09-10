import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
// If your Prisma file is located elsewhere, you can change the path
import { Polar } from "@polar-sh/sdk";
import { env } from "~/env";
import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { db } from "~/server/db";

const polarClient = new Polar({
  accessToken: env.POLAR_ACCESS_TOKEN,
  server: "sandbox",
});

const prisma = new PrismaClient();
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql", // or "mysql", "postgresql", ...etc
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: [
            {
              productId: "43585d8b-a849-485c-a359-7773d185d8ef",
              slug: "small",
            },
            {
              productId: "ba9b9094-3f22-4933-86f2-7d74cdcfbf52",
              slug: "medium",
            },
            {
              productId: "2c7735ec-5758-4c6a-8907-da76dced50b6",
              slug: "large",
            },
          ],
          successUrl: "/dashboard",
          authenticatedUsersOnly: true,
        }),
        portal(),
        webhooks({
          secret: env.POLAR_WEBHOOK_SECRET,
          onOrderPaid: async (order) => {
            const externalCustomerId = order.data.customer.externalId;

            if (!externalCustomerId) {
              console.error("No external customer ID found.");
              throw new Error("No external customer id found.");
            }

            const productId = order.data.productId;

            let creditsToAdd = 0;

            switch (productId) {
              case "43585d8b-a849-485c-a359-7773d185d8ef":
                creditsToAdd = 50;
                break;
              case "ba9b9094-3f22-4933-86f2-7d74cdcfbf52":
                creditsToAdd = 200;
                break;
              case "2c7735ec-5758-4c6a-8907-da76dced50b6":
                creditsToAdd = 400;
                break;
            }

            await db.user.update({
              where: { id: externalCustomerId },
              data: {
                credits: {
                  increment: creditsToAdd,
                },
              },
            });
          },
        }),
      ],
    }),
  ],
});
