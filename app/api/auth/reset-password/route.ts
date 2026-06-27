import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { token, newPassword } = await req.json();

  if (!token || !newPassword) {
    return NextResponse.json({ error: "Données manquantes." }, { status: 400 });
  }
  if (String(newPassword).length < 8) {
    return NextResponse.json(
      { error: "Mot de passe trop court (8 caractères minimum)." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: String(token),
      resetTokenExp: { gt: new Date() },
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Lien invalide ou expiré." },
      { status: 400 },
    );
  }

  const hashed = await bcrypt.hash(String(newPassword), 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, resetToken: null, resetTokenExp: null },
  });

  return NextResponse.json({ success: true });
}
