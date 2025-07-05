import logging
from urllib import parse

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

import os

# Paths to input parquet files; change these as needed
SOURCE_ARTICLES_PATH = os.environ.get("SOURCE_ARTICLES_PATH", "/path/to/source_articles.parquet")
SCORED_DATA_PATH = os.environ.get("SCORED_DATA_PATH", "/path/to/score_data.parquet")


def fix_title(title):
    return parse.unquote(title).replace('_', ' ')

def normalize_html_text(text):
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
    tokenizer = Tokenizer(language_code='en')
    sections = []
    current_offset = 0
    sen_idx = 0
    for _, section in sections_df.iterrows():
        section_data = {'title': section['title']}
        section_sentences = []
        for sentence in tokenizer.sentence_tokenize(section['text'], use_abbreviation=True):
            sentence_data = {
                'idx': sen_idx,
                'start': current_offset,
                'end': current_offset + len(sentence),
                'sentence': sentence
            }
            section_sentences.append(sentence_data)
            sen_idx += 1
            current_offset += len(sentence)
        section_data['sentences'] = section_sentences
        sections.append(section_data)

    return sections


def build_wiki_url(lang, title, revid):
    base_url = f"https://{lang}.wikipedia.org/w/index.php?"
    if title is not None and revid is not None:
        return f"{base_url}title={title}&oldid={revid}"
    elif title is not None:
        return f"{base_url}title={title}"
    elif revid is not None:
        return f"{base_url}oldid={revid}"
    else:
        raise ValueError('Title or Oldid is required')


def build_meta_data_endpoint(lang, title):
    return f"https://{lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&list=&piprop=thumbnail&prop=pageimages%7Cdescription&titles={title}"


def parse_article(lang='en', title=None, revid=None):
    url = build_wiki_url(lang, title, revid)

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
        'title': title,
        'revid': revid,
        'sections': sections
    }

    metadata = fetch_article_metadata(lang, title)
    article['thumbnail'] = metadata['thumbnail']
    article['description'] = metadata['description']
    logging.info(article)

    return article


def fetch_article_metadata(lang: str, title: str) -> dict:
    # Construct metadata endpoint
    meta_data_url = build_meta_data_endpoint(lang, title)
    meta_data = requests.get(meta_data_url).json()
    logging.info(f"Extracting metadata from {meta_data}")
    thumbnail = {}
    description = ''
    if 'query' in meta_data and 'pages' in meta_data['query']:
        pages = meta_data['query']['pages']
        if pages:
            page = pages[0]
            thumbnail = page.get('thumbnail', {})
            description = page.get('description', '')
    return {"thumbnail": thumbnail, "description": description}
