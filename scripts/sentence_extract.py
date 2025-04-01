#!/usr/bin/env python3
"""
Sentence Extractor for Wikipedia Articles

This script extracts sentences from a Wikipedia article using mw-tokenizer and calculates
their offsets from the start of the first p-tag to the last p-tag in the container with
id "mw-content-text". It uses pandas DataFrames for data manipulation and saves the output
to a JSON file.

Usage:
    python sentence_extract.py <wikipedia_url> [--output OUTPUT]

Arguments:
    wikipedia_url: URL of the Wikipedia article to process
    --output: Optional path to the output JSON file (default: <page_title>_sentences.json)

Output:
    A JSON file containing the extracted sentences with their metadata.

Examples:
    # Extract sentences from a Wikipedia article
    python sentence_extract.py https://en.wikipedia.org/wiki/Python_(programming_language)

    # Extract sentences and save to a specific file
    python sentence_extract.py https://en.wikipedia.org/wiki/Python_(programming_language) --output python_sentences.json
"""

import argparse
import json
import logging
import sys

# Import utility functions from the common module
from wiki_sentence_utils import parse_article

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


def main():
    parser = argparse.ArgumentParser(description="Extract sentences from a Wikipedia article")
    parser.add_argument("url", type=str, help="URL of the Wikipedia article to process")
    parser.add_argument("--output", type=str, help="Path to the output JSON file")
    args = parser.parse_args()

    try:
        logging.info(f"Processing article from URL: {args.url}")

        # Extract sentences using the utility function
        article = parse_article(args.url)
        # Determine output file path
        if args.output:
            output_path = args.output
        else:
            # Extract page title from URL
            page_title = args.url.split('/')[-1]
            output_path = f"{page_title}_sentences.json"

        # Save to JSON file
        # sentences.to_json(output_path, orient='records', indent=2)
        json.dump(article, open(output_path, 'w'), indent=2)
        logging.info(
            f"Extracted {article['title']} with number of sections {len(article['sections'])} and saved to {output_path}")

    except Exception as e:
        logging.error(f"Error processing article: {e}")
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
