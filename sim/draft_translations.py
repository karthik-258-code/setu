#!/usr/bin/env python3
"""Create Telugu/Hindi machine-draft suggestions from a local IndicTrans2 model."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Callable, Sequence

LANGUAGES = {"te": "tel_Telu", "hi": "hin_Deva"}
SOURCE_LANGUAGE = "eng_Latn"
REVIEW_STATUS = "machine_draft"
Translator = Callable[[Sequence[str], str], Sequence[str]]


def _escape_pointer(value: str) -> str:
    return value.replace("~", "~0").replace("/", "~1")


def collect_missing_texts(
    document: object,
) -> list[dict[str, str]]:
    targets: list[dict[str, str]] = []

    def visit(value: object, path: tuple[str, ...]) -> None:
        if isinstance(value, dict):
            english = value.get("en")
            if isinstance(english, str) and english.strip():
                pointer = (
                    "/" + "/".join(_escape_pointer(part) for part in path) if path else ""
                )
                for language in LANGUAGES:
                    translated = value.get(language)
                    if not isinstance(translated, str) or not translated.strip():
                        targets.append(
                            {
                                "path": pointer,
                                "language": language,
                                "sourceText": english,
                            }
                        )
            for key, child in value.items():
                if isinstance(child, (dict, list)):
                    visit(child, (*path, str(key)))
        elif isinstance(value, list):
            for index, child in enumerate(value):
                if isinstance(child, (dict, list)):
                    visit(child, (*path, str(index)))

    visit(document, ())
    return targets


def create_drafts(
    targets: Sequence[dict[str, str]], translate: Translator, batch_size: int = 8
) -> list[dict[str, str]]:
    if batch_size < 1:
        raise ValueError("batch_size must be at least 1.")
    drafts: list[dict[str, str]] = []
    for language in LANGUAGES:
        language_targets = [item for item in targets if item["language"] == language]
        for start in range(0, len(language_targets), batch_size):
            batch = language_targets[start : start + batch_size]
            translated = list(
                translate([item["sourceText"] for item in batch], language)
            )
            if len(translated) != len(batch):
                raise ValueError(
                    f"Translator returned {len(translated)} results for "
                    f"{len(batch)} {language} inputs."
                )
            for item, text in zip(batch, translated):
                if not isinstance(text, str) or not text.strip():
                    raise ValueError(
                        f"Translator returned an empty {language} draft for {item['path']}."
                    )
                drafts.append(
                    {
                        "path": item["path"],
                        "language": language,
                        "sourceText": item["sourceText"],
                        "draftText": text,
                        "reviewStatus": REVIEW_STATUS,
                    }
                )
    return drafts


class IndicTrans2Translator:
    def __init__(self, model_dir: Path, batch_size: int) -> None:
        if batch_size < 1:
            raise ValueError("batch_size must be at least 1.")
        if not model_dir.is_dir():
            raise FileNotFoundError(
                f"Local IndicTrans2 model directory not found: {model_dir}"
            )
        try:
            import torch
            from IndicTransToolkit import IndicProcessor
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        except ImportError as error:
            raise RuntimeError(
                "Install sim/requirements-translation.txt in a separate Python "
                "environment before running the IndicTrans2 drafter. "
                "IndicTransToolkit documents Linux/macOS support; use WSL on Windows."
            ) from error

        self.batch_size = batch_size
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.processor = IndicProcessor(inference=True)
        self.tokenizer = AutoTokenizer.from_pretrained(
            str(model_dir), trust_remote_code=True, local_files_only=True
        )
        self.model = AutoModelForSeq2SeqLM.from_pretrained(
            str(model_dir), trust_remote_code=True, local_files_only=True
        ).to(self.device)
        self.model.eval()
        self.torch = torch

    def __call__(self, texts: Sequence[str], language: str) -> list[str]:
        if language not in LANGUAGES:
            raise ValueError(f"Unsupported target language: {language}")
        language_code = LANGUAGES[language]
        translations: list[str] = []
        for start in range(0, len(texts), self.batch_size):
            batch = list(texts[start : start + self.batch_size])
            processed = self.processor.preprocess_batch(
                batch,
                src_lang=SOURCE_LANGUAGE,
                tgt_lang=language_code,
                visualize=False,
            )
            inputs = self.tokenizer(
                processed,
                padding="longest",
                return_tensors="pt",
            ).to(self.device)
            with self.torch.inference_mode():
                outputs = self.model.generate(
                    **inputs,
                    num_beams=5,
                    num_return_sequences=1,
                    max_length=512,
                )
            decoded = self.tokenizer.batch_decode(
                outputs,
                skip_special_tokens=True,
                clean_up_tokenization_spaces=True,
            )
            translations.extend(
                self.processor.postprocess_batch(decoded, lang=language_code)
            )
        return translations


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="Content JSON to scan.")
    parser.add_argument(
        "--output", type=Path, required=True, help="Separate machine-draft review queue."
    )
    parser.add_argument(
        "--model-dir",
        type=Path,
        required=True,
        help="Pre-downloaded IndicTrans2 checkpoint; model loading is offline.",
    )
    parser.add_argument("--batch-size", type=int, default=8)
    args = parser.parse_args()

    if args.input.resolve() == args.output.resolve():
        parser.error("--output must not overwrite --input.")
    document = json.loads(args.input.read_text(encoding="utf-8"))
    targets = collect_missing_texts(document)
    drafts = []
    if targets:
        translator = IndicTrans2Translator(args.model_dir, args.batch_size)
        drafts = create_drafts(targets, translator, args.batch_size)
    report = {
        "sourceLanguage": SOURCE_LANGUAGE,
        "model": "IndicTrans2 local checkpoint",
        "reviewRequired": True,
        "drafts": drafts,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Wrote {len(drafts)} machine-draft translations to {args.output}")


if __name__ == "__main__":
    main()
