#!/usr/bin/env python3
"""
Utility functions for extracting and processing sentences from Wikipedia articles.

This module provides common functions used by both the sentence extraction and
sentence scoring scripts, reducing code duplication.
"""

import logging

import pandas as pd
import requests
from lxml import html
from mwtokenizer.tokenizer import Tokenizer

xpath_condition = """
    //div[@id='mw-content-text']//text()[
        not(ancestor-or-self::noscript)
        and not(ancestor-or-self::h2)
        and not(ancestor-or-self::h3)
        and not(ancestor-or-self::*/@class='mw-headline')
        and not(ancestor-or-self::*/@class='mw-headline mw-heading2')
        and not(ancestor-or-self::style)
        and not(ancestor-or-self::cite)
        and not(ancestor-or-self::script)
        and not(ancestor-or-self::table)
        and not(ancestor-or-self::img)
        and not(ancestor-or-self::figure)
        and not(ancestor-or-self::sup)
        and not(ancestor-or-self::*/@class='mw-editsection')
        and not(ancestor-or-self::*/@class='mw-bandeau')
        and not(ancestor-or-self::*/@class='reflist')
        and not(ancestor-or-self::*/@class='map')
        and not(ancestor::div[
            contains(@class, "js-interprojects")
            or contains(@class, "galleryext")
            or contains(@class, "mw-headline")
            or contains(@class, "thumb") 
            or contains(@role, "navigation") 
            or contains(@role, "note") 
            or contains(@class, "navbox") 
            or contains(@class, "toc") 
            or contains(@class, "reflist")
            or contains(@class, "printfooter")
            or contains(@class, "soslink")
            or contains(@style, "float:")
            or contains(@style, "display:none")
            or contains(@class, "bandeau")
            or contains(@class, "infobox")
            or contains(@class, "references")
            or contains(@class, "side-box")
            or contains(@class, "plainlinks")
            or contains(@class, "sisterbox")
            or contains(@class, "references")
        ])
    ]
    """

xpath_section = """preceding::h2[
        ancestor::div[@id="mw-content-text"]
        and not(ancestor-or-self::noscript)
        and not(ancestor-or-self::style)
        and not(ancestor-or-self::cite)
        and not(ancestor-or-self::script)
        and not(ancestor-or-self::table)
        and not(ancestor::div[
            contains(@class, "thumb") 
            or contains(@role, "navigation") 
            or contains(@class, "navbox") 
            or contains(@class, "toc") 
            or contains(@class, "reflist")
            or contains(@class, "printfooter")
            or contains(@class, "soslink")
            or contains(@style, "float:")
        ])
    ][1]
    """

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


def normalize_html_text(text):
    """
    Normalize text according to HTML rendering rules:
    1. Remove spaces/tabs before and after line breaks
    2. Convert tabs to spaces
    3. Convert line breaks to spaces
    4. Remove duplicate spaces
    5. Trim leading and trailing spaces
    """
    # Remove spaces and tabs before and after line breaks
    text = text.replace('\r\n', '\n')  # Normalize line breaks
    lines = text.split('\n')
    lines = [line.strip() for line in lines]
    text = ' '.join(lines)

    # Replace tabs with spaces
    text = text.replace('\t', ' ')

    # Remove duplicate spaces
    while '  ' in text:
        text = text.replace('  ', ' ')

    # Trim leading and trailing spaces
    return text.strip()


def build_sections(text_nodes, xpath_section):
    """
    For each text node, find the closest preceding <h2> in the DOM.
    Use its text content as the section title, or 'lead' if none.
    Accumulate text into sections with 'title', 'text', 'start', 'end'.
    Apply HTML-style text normalization.

    Args:
        text_nodes: List of text nodes from the HTML document
        xpath_section: XPath expression to find the section heading

    Returns:
        A pandas DataFrame with columns: title, text, start, end
    """
    sections_data = []
    offset = 0

    for node in text_nodes:
        # Normalize the text node content
        text = node
        if text.strip() == '':
            continue

        preceding_h2 = node.getparent().xpath(xpath_section)
        if preceding_h2:
            section_title = normalize_html_text(preceding_h2[0].text_content())
        else:
            section_title = "lead"

        # Check if we already have a section with this title
        if sections_data and sections_data[-1]['title'] == section_title:
            # Update the existing section
            sections_data[-1]['text'] += text
            sections_data[-1]['end'] = offset + len(sections_data[-1]['text'])
        else:
            # Create a new section
            sections_data.append({
                'title': section_title,
                'text': text,
                'start': offset,
                'end': offset + len(text)
            })

        offset += len(text)

    # Filter out empty sections
    sections_data = [sec for sec in sections_data if sec['text'].strip()]

    # Convert to pandas DataFrame
    sections_df = pd.DataFrame(sections_data)

    return sections_df


def get_sentences(sections_df):
    """
    Tokenize sentences from a DataFrame of sections with proper tracking of section, offset, and sentence metadata.

    Args:
        sections_df: DataFrame containing sections with 'title' and 'text' columns

    Returns:
        A pandas DataFrame with columns: sen-id, section, start, end, sentence
    """
    tokenizer = Tokenizer(language_code='en')
    sections = []
    current_offset = 0

    for _, section in sections_df.iterrows():
        section_data = {'title': section['title']}
        section_sentences = []
        for sen_id, sentence in enumerate(tokenizer.sentence_tokenize(section['text'], use_abbreviation=True)):
            sentence_data = {
                'sen-id': sen_id,
                'start': current_offset,
                'end': current_offset + len(sentence),
                'sentence': sentence
            }
            section_sentences.append(sentence_data)
            current_offset += len(sentence)
        section_data['sentences'] = section_sentences
        sections.append(section_data)

    return sections


def parse_article(url):
    """
    Extract sentences from a Wikipedia article.

    Args:
        url: URL of the Wikipedia article

    Returns:
        A pandas DataFrame containing the extracted sentences
    """
    # `https://${lang}.wikipedia.org/w/index.php?title=${title}&curid=${curid}&oldid=${oldid}`
    logging.info(f"Extracting sentences from {url}")

    # Fetch the Wikipedia article
    html_content = requests.get(url).text

    # Parse the HTML
    tree = html.fromstring(html_content)

    # Extract text nodes
    text_nodes = tree.xpath(xpath_condition)

    # Build sections
    sections_df = build_sections(text_nodes, xpath_section)

    # Get sentences
    sections = get_sentences(sections_df)
    # print the type of sections

    article = {
        'title': url.split('/')[-1].replace('_', ' '),
        'rev_id': None,
        'sections': sections
    }

    return article


def extract_lead_section(url):
    """
    Extract the lead section from a Wikipedia article.

    Args:
        url: URL of the Wikipedia article

    Returns:
        A tuple containing (title, lead_text)
    """
    logging.info(f"Extracting lead section from {url}")

    # Extract the title from the URL
    title = url.split('/')[-1].replace('_', ' ')

    # Fetch the Wikipedia article
    html_content = requests.get(url).text

    # Parse the HTML
    tree = html.fromstring(html_content)
    # Extract text nodes
    text_nodes = tree.xpath(xpath_condition)

    # Build sections
    sections_df = build_sections(text_nodes, xpath_section)

    # Get the lead section
    lead_section = sections_df[sections_df['title'] == 'lead']

    if len(lead_section) == 0:
        logging.warning(f"No lead section found in {url}")
        return title, ""

    return title, lead_section.iloc[0]['text']
