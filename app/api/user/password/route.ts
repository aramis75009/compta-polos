import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json() as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "Le nouveau mot de passe doit faire au moins 8 caractères." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }

  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) {
    return NextResponse.json(
      { error: "Mot de passe actuel incorrect." },
      { status: 400 },
    );
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { email: session.user.email },
    data: { password: hash },
  });

  return NextResponse.json({ success: true });
}
