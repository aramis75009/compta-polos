#!/usr/bin/env python3
"""
organiser_annonces.py
---------------------
Organise les annonces MyFlip depuis ~/Downloads vers ~/Desktop/Annonces/

Gère deux cas :
  • Dossier dézippé automatiquement par macOS : SDM51_annonce/
  • ZIP encore intact : SDM51_annonce.zip

Structure générée :
  • Commande à marque identifiée → Annonces/{Commande}/{Marque}/{SKU}/
  • Commande mix (marque vide/mix) → Annonces/{Commande}/{SKU}/

Usage :
  python3 organiser_annonces.py          # aperçu dry-run
  python3 organiser_annonces.py --apply  # applique
"""

import re
import sys
import zipfile
import shutil
from pathlib import Path

DOWNLOADS = Path.home() / "Downloads"
DEST_ROOT = Path.home() / "Desktop" / "Annonces"
DRY_RUN   = "--apply" not in sys.argv


def parse_annonce_txt(txt: str) -> dict:
    data = {}
    for key in ("SKU", "COMMANDE", "MARQUE", "CATEGORIE"):
        m = re.search(rf"^{key}[:\s]+(.+)$", txt, re.MULTILINE)
        if m:
            data[key.lower()] = m.group(1).strip()
    return data


def sanitize(name: str) -> str:
    return re.sub(r'[/:*?"<>|\\]', "_", name).strip() or "Autre"


def is_mix(marque: str) -> bool:
    return not marque or "mix" in marque.lower()


def build_dest_dir(meta: dict) -> Path:
    sku      = sanitize(meta.get("sku", "INCONNU"))
    commande = sanitize(meta.get("commande", ""))
    marque   = sanitize(meta.get("marque", ""))
    categorie = sanitize(meta.get("categorie", ""))

    if commande and commande != "Autre":
        if is_mix(meta.get("marque", "")):
            return DEST_ROOT / commande / sku
        else:
            return DEST_ROOT / commande / marque / sku
    else:
        # Anciens exports sans champ COMMANDE
        if is_mix(meta.get("marque", "")):
            label = f"{categorie} mix" if categorie and categorie != "Autre" else "Mix"
            return DEST_ROOT / label / sku
        else:
            return DEST_ROOT / marque / categorie / sku


def read_from_zip(zip_path: Path):
    """Lit métadonnées + fichiers depuis un ZIP."""
    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            txt_files = [f for f in z.namelist() if f.endswith("_annonce.txt")]
            if not txt_files:
                return None, []
            txt = z.read(txt_files[0]).decode("utf-8", errors="replace")
            meta = parse_annonce_txt(txt)
            if not meta.get("sku"):
                meta["sku"] = zip_path.stem.replace("_annonce", "")
            files = [(name, z.read(name)) for name in z.namelist()]
            return meta, files
    except zipfile.BadZipFile:
        return None, []


def read_from_folder(folder: Path):
    """Lit métadonnées + fichiers depuis un dossier dézippé."""
    txt_files = list(folder.glob("*_annonce.txt"))
    if not txt_files:
        return None, []
    txt = txt_files[0].read_text(encoding="utf-8", errors="replace")
    meta = parse_annonce_txt(txt)
    if not meta.get("sku"):
        meta["sku"] = folder.name.replace("_annonce", "")
    files = [f for f in folder.iterdir() if f.is_file()]
    return meta, files


def main():
    print(f"{'[DRY-RUN] ' if DRY_RUN else ''}Scan de {DOWNLOADS}\n")

    # Cherche ZIPs et dossiers *_annonce
    sources: list[tuple[str, Path]] = []
    for p in DOWNLOADS.iterdir():
        if p.is_file() and p.suffix == ".zip" and p.stem.endswith("_annonce"):
            sources.append(("zip", p))
        elif p.is_dir() and p.name.endswith("_annonce"):
            sources.append(("folder", p))

    sources.sort(key=lambda x: x[1].name)

    if not sources:
        print("Aucune annonce trouvée dans ~/Downloads.")
        print("(cherche les dossiers *_annonce/ et fichiers *_annonce.zip)")
        return

    moved = 0
    skipped = 0

    for kind, source in sources:
        if kind == "zip":
            meta, zip_files = read_from_zip(source)
        else:
            meta, folder_files = read_from_folder(source)

        if not meta:
            print(f"  ⚠  {source.name} — non reconnu, ignoré")
            skipped += 1
            continue

        dest_dir = build_dest_dir(meta)
        rel = dest_dir.relative_to(Path.home() / "Desktop")

        print(f"  {'📦' if kind == 'zip' else '📁'} {source.name}")
        print(f"    commande : {meta.get('commande') or '—'}  |  marque : {meta.get('marque') or 'mix'}")
        print(f"    → Desktop/{rel}/")

        if not DRY_RUN:
            dest_dir.mkdir(parents=True, exist_ok=True)
            if kind == "zip":
                with zipfile.ZipFile(source, "r") as z:
                    z.extractall(dest_dir)
            else:
                for f in folder_files:
                    shutil.copy2(f, dest_dir / f.name)
            print(f"    ✅ Copié")

        moved += 1
        print()

    print(f"{'[DRY-RUN] ' if DRY_RUN else ''}{moved} annonce(s) traitée(s), {skipped} ignorée(s).")
    if DRY_RUN:
        print("\n👉 Pour appliquer :")
        print("   python3 ~/Desktop/SAAS\\ perso\\ my\\ flip/organiser_annonces.py --apply")


if __name__ == "__main__":
    main()
