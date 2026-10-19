"""Monta a Biblioteca Finanças que Curam a partir do banco de conteúdo FQC.

Uso:
  python3 publicar.py --export DIR_DOS_JSON [--assets DIR_DAS_FOTOS] [--agora 2026-10-20T12:05]

- DIR_DOS_JSON: os documentos da coleção "conteudos" do banco, um .json por conteúdo
  (o formato que a leitura do banco salva com out_dir).
- DIR_DAS_FOTOS: fotos do banco já baixadas, com o nome <asset_id>.<ext>.

Publica só o que está aprovado ou publicado, com destino "site" ou "ambos" e com data e hora
já alcançadas no horário de Fortaleza. Gera posts.json e copia as fotos para img/.
Imprime as fotos que faltam baixar e os conteúdos que ainda não têm sitePublicadoEm no banco
(os que entram no site nesta rodada).
"""
import argparse, datetime as dt, glob, json, os, re, sys

AQUI = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "biblioteca")
TZ = dt.timezone(dt.timedelta(hours=-3))  # Fortaleza não tem horário de verão

# Links do banco que viram caminhos da própria Biblioteca
RAW = "https://raw.githubusercontent.com/alineseabracampos1-oss/coopplantao/claude/manada-content-plan-q4-fgs3np/docs/manada/materiais/"
MATERIAL = {
    "https://claude.ai/artifact/QuVwY8NQafcfRWtFy1gCci": "decisor/",
    "https://claude.ai/artifact/HzG4sBjKQ2vhuKBY86UTKG": "quiz/",
}


def hora_min(h):
    m = re.search(r"(\d{1,2})(?:\s*[:h]\s*(\d{2}))?", h or "")
    return (int(m.group(1)) * 60 + int(m.group(2) or 0)) if m else 0


def quando(c):
    y, mo, d = map(int, c["data"].split("-"))
    mm = hora_min(c.get("horario"))
    return dt.datetime(y, mo, d, min(mm // 60, 23), mm % 60, tzinfo=TZ)


def slides(texto):
    raw = (texto or "").replace("\r", "")
    partes = re.split(r"\n\s*-{3,}\s*\n", raw) if re.search(r"\n\s*-{3,}\s*\n", raw) else re.split(r"\n\s*\n", raw)
    out = []
    for p in partes:
        p = p.strip()
        if not p:
            continue
        t, *resto = p.split("\n")
        out.append({"t": t.strip(), "b": re.sub(r"\n\s*\n", "\n", "\n".join(resto)).strip()})
    return out


def material(url):
    if not url:
        return ""
    if url.startswith(RAW):
        return "materiais/" + url[len(RAW):]
    return MATERIAL.get(url, url)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--export", required=True)
    ap.add_argument("--assets", default="")
    ap.add_argument("--agora", default="")
    a = ap.parse_args()
    agora = dt.datetime.fromisoformat(a.agora).replace(tzinfo=TZ) if a.agora else dt.datetime.now(TZ)

    pj = os.path.join(AQUI, "posts.json")
    novos = []

    posts, faltam = [], []
    for f in sorted(glob.glob(os.path.join(a.export, "*.json"))):
        c = json.load(open(f, encoding="utf-8"))
        cid = os.path.splitext(os.path.basename(f))[0]
        if c.get("status") not in ("aprovado", "publicado") or c.get("destino") not in ("site", "ambos") or not c.get("data"):
            continue
        if quando(c) > agora:
            continue
        imgs = []
        for im in c.get("imagens") or []:
            aid = im.get("id")
            achou = glob.glob(os.path.join(a.assets, aid + ".*")) if a.assets and aid else []
            if not achou:
                faltam.append(aid)
                continue
            from PIL import Image, ImageOps  # só quando há foto
            dst = os.path.join(AQUI, "img", aid + ".jpg")
            if not os.path.exists(dst):
                img = ImageOps.exif_transpose(Image.open(achou[0])).convert("RGB")
                img.thumbnail((1600, 1600))
                img.save(dst, "JPEG", quality=82, optimize=True, progressive=True)
            imgs.append("img/" + aid + ".jpg")
        if not c.get("sitePublicadoEm"):
            novos.append(cid)
        deck = c.get("tipo") == "Carrossel"
        posts.append({
            "id": cid, "titulo": c.get("titulo", ""), "tipo": c.get("tipo", ""), "quadro": c.get("quadro", ""),
            "data": c["data"], "horario": c.get("horario", ""), "quando": quando(c).isoformat(),
            "texto": "" if deck else c.get("texto", ""), "slides": slides(c.get("texto")) if deck else [],
            "legenda": c.get("legenda", ""), "material": material(c.get("material")), "imagens": imgs,
        })
    posts.sort(key=lambda p: p["quando"], reverse=True)
    json.dump({"atualizado": agora.isoformat(), "posts": posts}, open(pj, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps({"publicados": len(posts), "novos": novos, "fotos_faltando": sorted(set(faltam))}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
