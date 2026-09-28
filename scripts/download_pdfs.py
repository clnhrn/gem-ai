"""Download gemstone reference PDFs (all public domain) for GemAI."""

import re
import textwrap
import time
import urllib.request
import urllib.error
from pathlib import Path

from tqdm import tqdm

HEADERS = {"User-Agent": "Mozilla/5.0"}
opener = urllib.request.build_opener()
opener.addheaders = [("User-Agent", HEADERS["User-Agent"])]
urllib.request.install_opener(opener)

MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds

SOURCES = [
    {
        "name": "usgs-natural-gemstones",
        "url": "https://pubs.usgs.gov/gip/7000029/report.pdf",
    },
    {
        "name": "usgs-gemstones-mcs-2026",
        "url": "https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-gemstones.pdf",
    },
    {
        "name": "smithsonian-gems",
        "url": "https://www.gutenberg.org/cache/epub/62879/pg62879.txt",
        "convert": "text-to-pdf",
    },
]


def download_file(url: str, dest: Path) -> bool:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            urllib.request.urlretrieve(url, dest)
            return True
        except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
            if attempt < MAX_RETRIES:
                print(f"    retry {attempt}/{MAX_RETRIES}: {e}")
                time.sleep(RETRY_DELAY * attempt)
            else:
                print(f"    failed after {MAX_RETRIES} attempts: {e}")
                dest.unlink(missing_ok=True)
                return False


def gutenberg_text_to_pdf(txt_path: Path, pdf_path: Path):
    from fpdf import FPDF

    text = txt_path.read_text(encoding="utf-8")

    start = text.find("*** START OF THE PROJECT GUTENBERG EBOOK")
    end = text.find("*** END OF THE PROJECT GUTENBERG EBOOK")
    if start > 0:
        text = text[text.index("\n", start) + 1 :]
    if end > 0:
        text = text[:end]

    text = re.sub(r"\[Illustration:[^\]]*\]", "", text, flags=re.DOTALL)
    text = re.sub(r"_([^_]+)_", r"\1", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    pdf = FPDF(format="letter")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_left_margin(15)
    pdf.set_right_margin(15)
    pdf.add_font("DejaVu", "", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    pdf.add_page()
    pdf.set_font("DejaVu", size=10)

    for line in text.split("\n"):
        line = line.strip()
        if line == "":
            pdf.ln(3)
        else:
            for wl in textwrap.wrap(line, width=90):
                pdf.cell(w=0, h=5, text=wl, new_x="LMARGIN", new_y="NEXT")

    pdf.output(str(pdf_path))
    txt_path.unlink()


def main():
    out_dir = Path(__file__).resolve().parent.parent / "data"
    out_dir.mkdir(exist_ok=True)

    print(f"Downloading {len(SOURCES)} gemstone PDFs to {out_dir} ...")

    success = 0
    failed = []

    for source in tqdm(SOURCES, desc="Downloading", unit="pdf"):
        name = source["name"]
        dest = out_dir / f"{name}.pdf"

        if source.get("convert") == "text-to-pdf":
            tmp_txt = out_dir / f"{name}.txt"
            if download_file(source["url"], tmp_txt):
                try:
                    gutenberg_text_to_pdf(tmp_txt, dest)
                    success += 1
                except Exception as e:
                    print(f"    conversion failed for {name}: {e}")
                    failed.append(name)
            else:
                failed.append(name)
        else:
            if download_file(source["url"], dest):
                success += 1
            else:
                failed.append(name)

    print(f"\nDone: {success} downloaded, {len(failed)} failed.")

    if failed:
        print(f"Failed: {', '.join(failed)}")


if __name__ == "__main__":
    main()
