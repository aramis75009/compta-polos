import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendResetEmail } from "@/lib/emails";

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "Email requis." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: String(email).trim().toLowerCase() },
  });

  if (user) {
    const token = crypto.randomUUID();
    const exp = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExp: exp },
    });
    await sendResetEmail(user.email, token);
  }

  // Toujours renvoyer success pour ne pas révéler si l'email existe
  return NextResponse.json({ success: true });
}
