"""
preprocessing.py

This module provides functions for preprocessing text data from revisions, 
including loading, cleaning, and merging sentences for both single and 
multiple article versions. It supports parallel processing for efficiency 
and outputs the results in specified formats.

Main Functionalities:
- Argument parsing for input/output paths and processing options.
- File existence validation before processing.
- Loading revisions and redirect files from specified paths.
- Cleaning, merging, and generating sentence contexts.
- Saving processed results in formats like Parquet.

Usage:
Run the module with command-line arguments specifying required paths. 
Example:
python preprocessing.py --revisions_path path/to/revisions.parquet 
                        --parsed_html_dir path/to/parsed_html 
                        --output_dir path/to/output 
                        --side_contexts_size 5

Note:
Ensure all paths are valid and accessible. This module requires 
external libraries such as pandas and tqdm.
"""


from calendar import c
from numpy import argsort
import pandas as pd
import argparse
from bs4 import MarkupResemblesLocatorWarning
import re
import difflib
import math
import numpy as np
from tqdm import tqdm
import os
import warnings
from multiprocessing import Pool, cpu_count
tqdm.pandas()
import time
from collections import Counter

from typing import Any, Dict, List, Optional, Union, Callable

warnings.filterwarnings("ignore", category=MarkupResemblesLocatorWarning)

def fix_target_titles(title: str,
redirect_map_1: Dict[str, str],
redirect_map_2: Dict[str, str]
) -> str:
    """
    Resolves the final title by following redirect chains in two maps.

    This function attempts to resolve a target title by checking if it exists 
    as a key in two redirect maps (`redirect_map_1` and `redirect_map_2`). 
    It follows the chain of redirects up to a maximum depth of 10 in each map 
    to avoid infinite loops. It is directly taken from Tomás Soares work.

    Args:
        title (str): The initial title to resolve.
        redirect_map_1 (dict[str, str]): The first mapping of titles to their redirects.
        redirect_map_2 (dict[str, str]): The second mapping of titles to their redirects.

    Returns:
        str: The resolved title after following redirects, or the original title if no 
        further redirects are found within the limit.
    """
    counter = 0
    while title in redirect_map_1:
        title = redirect_map_1[title]
        counter += 1
        if counter == 10:
            break

    counter = 0
    while title in redirect_map_2:
        title = redirect_map_2[title]
        counter += 1
        if counter == 10:
            break
            
    return title

def clean_condition(txt: str) -> bool:
    """
    Checks if the provided text meets the condition of being sentence-like.

    This function validates the input text by ensuring it contains more than 
    15 characters. It's intended to filter out short or incomplete sentences.

    Args:
        txt (str): The text string to evaluate.

    Returns:
        bool: True if the text is longer than 15 characters, otherwise False.
    """
    return len(txt) > 15
 
def merge_sentences(row1: Dict[str, Any], row2: Dict[str, Any]) -> Dict[str, Any]:
    """
    Merges two sentence data rows into a single row by concatenating their text, IDs, and locations.

    This function takes two dictionary rows, each containing sentence-related information 
    (e.g., text, IDs, indices, section, and locations), and merges them into a single row. 
    It concatenates the text fields, list of IDs, and list of locations, while keeping 
    the `startIdx` from the first row and the `endIdx` from the second row.

    Args:
        row1 (Dict[str, Any]): The first sentence data row with keys such as 'text', 'id', 'startIdx', 
                               'endIdx', 'section', and 'locList'.
        row2 (Dict[str, Any]): The second sentence data row with similar keys.

    Returns:
        Dict[str, Any]: A dictionary containing the merged sentence data.
                        Keys: 'text', 'id', 'startIdx', 'endIdx', 'section', 'locList'.
    """
    row = {}
    row['text'] = row1['text'] + '. ' + row2['text']  # Concatenate text with period.
    row['id'] = row1['id'] + row2['id']  # Concatenate lists of IDs.
    row['startIdx'] = row1['startIdx']  # Use the start index from the first row.
    row['endIdx'] = row2['endIdx']  # Use the end index from the second row.
    row['section'] = row1['section']  # Section is assumed to be the same.
    row['locList'] = row1['locList'] + row2['locList']  # Concatenate lists of locations.

    return row

def compute_sentence_similarity(sentence1: str, sentence2: str) -> float:
    """
    Computes the cosine similarity between two sentences based on word frequency.

    This function calculates the similarity between two sentences by treating 
    each as a vector of word frequencies and computing the cosine similarity 
    between them. The words are extracted, counted, and the cosine of the angle 
    between the two vectors is calculated as the similarity score.

    Args:
        sentence1 (str): The first sentence to compare.
        sentence2 (str): The second sentence to compare.

    Returns:
        float: The cosine similarity score between the two sentences, 
               ranging from 0 (completely dissimilar) to 1 (identical).
    """
    # Split and clean the sentences into words.
    words1 = [word.strip() for word in sentence1.replace('\n', ' ').split(' ') if word != '']
    words2 = [word.strip() for word in sentence2.replace('\n', ' ').split(' ') if word != '']

    # Compute word frequency for both sentences.
    freqs1 = Counter(words1)
    freqs2 = Counter(words2)

    # Calculate the L2 norm for both frequency vectors.
    norm1 = math.sqrt(sum([freqs1[word]**2 for word in freqs1]))
    norm2 = math.sqrt(sum([freqs2[word]**2 for word in freqs2]))

    # Calculate the dot product of the two frequency vectors.
    dot_product = sum(freqs1[word] * freqs2[word] for word in freqs1 if word in freqs2)

    # Compute the cosine similarity score.
    score = dot_product / (norm1 * norm2) if norm1 != 0 and norm2 != 0 else 0.0
    return score

def clean_sentences(sentences_df: pd.DataFrame) -> pd.DataFrame:
    """
    Cleans and merges sentences in the sentence DataFrame based on text conditions and sections.

    This function processes a DataFrame of sentences, filtering and merging incomplete 
    sentences within the same section. It applies text cleaning logic to determine 
    whether sentences are "clean" (sufficiently long) or "unclean" (incomplete). 
    Unclean sentences from the same section are merged until they form a valid sentence, 
    or until the section changes. The cleaned and merged sentences are returned as 
    a new DataFrame.

    Args:
        sentences_df (pd.DataFrame): A DataFrame containing sentence data. Expected columns:
                                     - 'id': A unique identifier for each sentence, which is 
                                             converted to a list.
                                     - 'text': The sentence text, which will be cleaned of 
                                               leading/trailing whitespace.
                                     - 'section': The section to which the sentence belongs.
                                     - 'startIdx', 'endIdx', 'locList': Other attributes related 
                                               to sentence positioning and metadata.

    Returns:
        pd.DataFrame: A new DataFrame containing cleaned and possibly merged sentences. 
                      The structure matches the input DataFrame with merged sentences.
    """
    new_sentences: List[Dict[str, Any]] = []
    current_unclean: Optional[Dict[str, Any]] = None

    # Ensure 'id' is a list and 'text' is stripped of whitespace.
    sentences_df['id'] = sentences_df['id'].apply(lambda x: [x])
    sentences_df['text'] = sentences_df['text'].apply(lambda x: x.strip())

    for _, row in sentences_df.iterrows():
        if row['text'] == '':
            continue  # Skip empty rows.

        row = row.to_dict()  # Convert the row to a dictionary for easier manipulation.
        
        if current_unclean is None:
            if clean_condition(row['text']):
                new_sentences.append(row)  # Add clean sentences directly.
            else:
                current_unclean = row  # Store unclean sentences for potential merging.
        elif current_unclean['section'] == row['section']:
            # Merge sentences from the same section.
            current_unclean = merge_sentences(current_unclean, row)
            if clean_condition(current_unclean['text']):
                new_sentences.append(current_unclean)
                current_unclean = None
        else:
            # When sections differ, process the unclean sentence.
            if len(new_sentences) > 0:
                if new_sentences[-1]['section'] == row['section']:
                    new_sentences[-1] = merge_sentences(new_sentences[-1], current_unclean)
                else:
                    new_sentences.append(current_unclean)
            else:
                new_sentences.append(current_unclean)
            
            current_unclean = None

            if clean_condition(row['text']):
                new_sentences.append(row)
            else:
                current_unclean = row
    
    # Add any remaining unclean sentence to the new sentences.
    if current_unclean is not None:
        new_sentences.append(current_unclean)
    
    return pd.DataFrame(new_sentences).reset_index(drop=True)

def fix_text(text: str) -> str:
    """
    Cleans and normalizes the input text by removing excess spaces and newlines.

    This function performs several text-cleaning operations:
    - Trims leading and trailing whitespace.
    - Replaces multiple consecutive spaces with a single space.
    - Replaces multiple consecutive newlines with a single newline.
    - Removes any spaces following newlines.
    It is directly taken from Tomás Soares work.

    Args:
        text (str): The input text to clean.

    Returns:
        str: The cleaned and normalized text.
    """
    # Remove leading and trailing whitespace.
    text = text.strip()

    # Replace multiple spaces with a single space.
    text = re.sub(' +', ' ', text)

    # Replace multiple newlines with a single newline.
    text = re.sub('\n+', '\n', text)

    # Remove spaces after newlines.
    text = re.sub('\n +', '\n', text)

    return text

def create_all_contexts(
    section_sentences: Dict[str, List[Dict[str, Any]]], 
    side_contexts_size: int
) -> List[Dict[str, Any]]:
    """
    Generates context windows around each sentence in a section, incorporating neighboring sentences.

    This function creates a context for each sentence by including surrounding sentences 
    from the same section. The size of the context is determined by `side_contexts_size`, 
    which specifies how many neighboring sentences to include on each side of the target sentence. 
    The resulting context is stored along with the original middle sentence and section information.

    Args:
        section_sentences (Dict[str, List[Dict[str, Any]]]): A dictionary where each key is a section name,
            and the value is a list of dictionaries representing sentences in that section. Each sentence 
            dictionary is expected to have a key `'clean_sentence'` containing the sentence text.
        side_contexts_size (int): The number of neighboring sentences to include on either side 
            of the middle sentence in the context.

    Returns:
        List[Dict[str, Any]]: A list of dictionaries, each containing:
            - 'context' (str): The combined context sentence window.
            - 'middle_sentence' (Dict[str, Any]): The original sentence around which the context is built.
            - 'section' (str): The section name where the sentence is located.
    """
    contexts: List[Dict[str, Any]] = []
    
    # Loop through each section and its sentences.
    for section in section_sentences:
        curr_sentences = section_sentences[section]
        
        # Loop through each sentence in the section.
        for i, sentence in enumerate(curr_sentences):
            min_index = max(0, i - side_contexts_size)  # Determine the minimum index for context.
            max_index = min(len(curr_sentences), i + side_contexts_size + 1)  # Maximum index for context.
            
            # Create the context by joining neighboring sentences.
            context = " ".join([s['clean_sentence']
                                for s in curr_sentences[min_index:max_index]]).strip()
            
            # Append the context, the middle sentence, and the section.
            contexts.append({
                'context': context, 
                'middle_sentence': sentence, 
                'section': section
            })

    return contexts

def get_group_indexes(diff: List[str]) -> List[Dict[int, str]]:
    """
    Processes a list of diff lines and identifies groupings of indexes based on their starting characters.

    This function analyzes a diff object wich is a list of strings, each starting with a specific character ('+', '-', '?', ' '),
    and groups them according to a set of rules. It handles various error conditions related to the positioning 
    of the '?' character in the diff lines. The function raises exceptions for invalid configurations
    and returns a list of dictionaries, where each dictionary maps line indexes to their corresponding 
    starting characters.
    Basically, it is a post process of the diff objects, it cleans out useless lines 
    and groups sentences together if they are the same afters lighlty modified. 

    Args:
        diff (List[str]): A list of strings representing lines from a diff output, where each line starts 
                          with a character that indicates a change ('+', '-', '?', or ' ').

    Returns:
        List[Dict[int, str]]: A list of dictionaries. Each dictionary represents a group of related lines, 
                              with the line index as the key and the starting character ('+', '-', '?', or ' ')
                              as the value.

    Raises:
        Exception: Various exceptions are raised if invalid conditions are encountered in the diff lines.
                   These include cases like:
                   - The index of a '?' line is 0.
                   - Unexpected spaces or characters before/after the '?' line.
                   - Sequences like '++?' or '--?' or other invalid groupings.
    """
    spe_indexes = [i for i, line in enumerate(diff) if line.startswith('?')]
    all_starts = [line[0] for line in diff]

    group_indexes: List[Dict[int, str]] = []
    last_added = -1

    for idx in spe_indexes:
        if idx == 0:
            raise Exception('Index 0')
        if all_starts[idx-1] == ' ':
            raise Exception('Space before ?')
        if all_starts[idx-1] == '+':
            if idx == 1:
                raise Exception('? Index 1 after +')
            if all_starts[idx-2] == ' ':
                raise Exception('Space before +?')
            if all_starts[idx-2] == '+':
                raise Exception('++?')
            if all_starts[idx-2] == '-':
                group_indexes.extend({j: all_starts[j]} for j in range(last_added+1, idx-2))
                group_indexes.append({idx-2: '-', idx-1: '+', idx: '?'})
                last_added = idx
                continue
            if all_starts[idx-2] == '?':
                if idx == 2:
                    raise Exception('? Index -2 after +') 
                if all_starts[idx-3] == ' ' or all_starts[idx-3] == '+':
                    raise Exception(' " "or+ ?+? ')
                continue
        if all_starts[idx-1] == '-':
            if idx == len(diff) - 1:
                raise Exception('-? at the end')
            if all_starts[idx+1] == ' ':
                raise Exception('Space after -?')
            if all_starts[idx+1] == '-':
                raise Exception('- -?')
            if all_starts[idx+1] == '+':
                if idx == len(diff) - 2:
                    group_indexes.extend({j: all_starts[j]} for j in range(last_added+1, idx-1))
                    group_indexes.append({idx-1: '-', idx: '?', idx+1: '+'})
                    last_added = idx+1
                    continue
                if all_starts[idx+2] == '?':
                    group_indexes.extend({j: all_starts[j]} for j in range(last_added+1, idx-1))
                    group_indexes.append({idx-1: '-', idx: '?', idx+1: '+', idx+2: '?'})
                    last_added = idx+2
                    continue
                else:
                    group_indexes.extend({j: all_starts[j]} for j in range(last_added+1, idx-1))
                    group_indexes.append({idx-1: '-', idx: '?', idx+1: '+'})
                    last_added = idx+1
                    continue
    
    if last_added != len(diff) - 1:
        group_indexes.extend({j: all_starts[j]} for j in range(last_added+1, len(diff)))

    return group_indexes

def process_single_version(input: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Processes a single version of a wikipedia page by loading, cleaning, and generating contexts 
    for sentences from a specified JSONL file.

    This function constructs the path to the JSONL file containing sentences, checks if 
    the file exists, and reads it into a DataFrame. It cleans the sentences, extracts 
    lead sentences, groups the sentences by section, and generates contexts. Finally, 
    it returns a structured output containing the title, ID, lead sentence, version, 
    and all contexts.

    Args:
        input (Dict[str, Any]): A dictionary containing necessary input data with the following keys:
            - 'source_ID' (str): The unique identifier for the source.
            - 'first_version' (str): The version identifier.
            - 'source_title' (str): The title of the source.

    Returns:
        List[Dict[str, Any]]: A list containing a single dictionary with the processed output, which includes:
            - 'title' (str): The title of the source.
            - 'ID' (str): The source ID.
            - 'lead' (str): The combined lead sentences.
            - 'version' (str): The version of the source.
            - 'all_contexts' (List[Dict]): The generated contexts from the sentences.
    
    Raises:
        Exception: Raised if the expected JSONL file does not exist or if no sentences are found in the file.
    """
    sentences_path = os.path.join(
        first_versions_html_dir, f"{input['source_ID']}_{input['first_version']}_sentences.jsonl")
    
    if not os.path.exists(sentences_path):
        print('No parsed HTML found')
        print(sentences_path)
        raise Exception('No parsed HTML found')
    
    sentences_1 = pd.read_json(sentences_path)
    if sentences_1.shape[0] == 0:
        print('No sentences found in 1')
        print(f"{input['source_ID']}_{input['first_version']}_sentences.jsonl")
        return []
    
    clean_sentences = clean_sentences(sentences_1)

    original_lead = ' '.join([sentence['clean_sentence'] for sentence in clean_sentences if sentence['section1'] == 'Lead'])

    section_sentences: Dict[str, List[Dict[str, Any]]] = {}
    for sentence in clean_sentences:
        if sentence['section1'] not in section_sentences:
            section_sentences[sentence['section1']] = []
        section_sentences[sentence['section1']].append(sentence)
        
    all_contexts = create_all_contexts(section_sentences, args.side_contexts_size)
    
    output = {
        'title': input['source_title'],
        'ID': input['source_ID'],
        'lead': original_lead.strip(),
        'version': input['first_version'],
        'all_contexts': all_contexts
    }

    return [output]

def process_two_versions(input: Dict[str, Union[str, List[str]]]) -> List[Dict[str, Any]]:
    """
    Processes two versions of text and compares their sentences and links.

    This function reads two versions of parsed HTML content, compares the sentences,
    and identifies changes such as additions, removals, or modifications. It returns
    a structured output detailing the differences and related links. It also build the contexts

    Parameters:
    ----------
    input : Dict[str, Union[str, List[str]]]
        A dictionary containing the following keys:
        - 'source_ID': The unique identifier for the source.
        - 'source_title': The title of the source.
        - 'first_version': The identifier for the first version.
        - 'versions': A list of identifiers for the versions to compare against the first version.

    Returns:
    -------
    List[Dict[str, Any]]
        A list of dictionaries containing details about the comparison results,
        including the status of each sentence and related links.

    Raises:
    ------
    Exception
        If any of the required JSONL files do not exist or if they contain no sentences.
    """
    output = []
    d = difflib.Differ()
    sentences_1_path = os.path.join(
        first_versions_html_dir, f"{input['source_ID']}_{input['first_version']}_sentences.jsonl")
    
    links_1_path = os.path.join(
       first_versions_html_dir, f"{input['source_ID']}_{input['first_version']}_links.jsonl")

    if not os.path.exists(sentences_1_path):
            print('No parsed HTML found')
            print(sentences_1_path)
            raise Exception('No parsed HTML found')

    if not os.path.exists(links_1_path):
            print('No links 1 found')
            print(links_1_path)
            raise Exception('No parsed HTML found')
    
    sentences_1 = pd.read_json(sentences_1_path)
    if sentences_1.shape[0] == 0:
        print('No sentences found in 1')
        print(f"{input['source_ID']}_{input['first_version']}_sentences.jsonl")
        return []
    
    all_links_1 = pd.read_json(links_1_path)
    all_links_1.dropna(inplace=True)

    clean_sentences_1 = clean_sentences(sentences_1)

    for second_version in input['versions']:

        sentences_2_path = os.path.join(
            args.parsed_html_dir, f"{input['source_ID']}_{second_version}_sentences.jsonl")

        links_2_path = os.path.join(
            args.parsed_html_dir, f"{input['source_ID']}_{second_version}_links.jsonl")
        
        if not os.path.exists(sentences_2_path):
            print('No parsed HTML found')
            print(sentences_2_path)
            raise Exception('No parsed HTML found')
        
        if not os.path.exists(links_2_path):
            print('No links 2 found')
            print(links_2_path)
            raise Exception('No parsed HTML found')

        sentences_2 = pd.read_json(sentences_2_path)
        if sentences_2.shape[0] == 0:
            print('No sentences found in 2')
            print(f"{input['source_ID']}_{second_version}_sentences.jsonl")
            continue

        all_links_2 = pd.read_json(links_2_path)
        all_links_2.dropna(inplace=True)

        if all_links_2.shape[0] == 0:
            print('No links found')
            print(f"{input['source_ID']}_{second_version}_links.jsonl")
            continue

        clean_sentences_2 = clean_sentences(sentences_2)
        
        original_lead = ''
        all_sentences = []
        diff = list(d.compare(list(clean_sentences_1['text']), list(clean_sentences_2['text'])))

        group_indexes = get_group_indexes(diff)

        index_in_1 = -1
        index_in_2 = -1

        for group in group_indexes:
            new_sentence = {}
            new_sentence['index'] = len(all_sentences)
            if len(group) == 1:
                i = list(group.keys())[0]
                sign = group[i]

                if sign not in ['+', '-', ' ']:
                    raise Exception('Invalid sign')


                new_sentence['clean_sentence'] = diff[i][2:].strip()
                new_sentence['status'] = 'added' if sign == '+' else (
                                        'removed' if sign == '-' else 'neutral')
                
                if sign == '+':
                    new_sentence['added_after'] = clean_sentences_1['id'][index_in_1] if index_in_1 >= 0 else [-1]


                if sign == ' ' or sign == '-':
                    index_in_1 += 1
                    new_sentence['section1'] = clean_sentences_1['section'][index_in_1]
                    new_sentence['ids1'] = clean_sentences_1['id'][index_in_1]
                    new_sentence['startIdx1'] = clean_sentences_1['startIdx'][index_in_1]
                    new_sentence['endIdx1'] = clean_sentences_1['endIdx'][index_in_1]
                    new_sentence['locList1'] = clean_sentences_1['locList'][index_in_1]
                
                if sign == ' ' or sign == '+':
                    index_in_2 += 1
                    new_sentence['section2'] = clean_sentences_2['section'][index_in_2]
                    new_sentence['ids2'] = clean_sentences_2['id'][index_in_2]
                    new_sentence['startIdx2'] = clean_sentences_2['startIdx'][index_in_2]
                    new_sentence['endIdx2'] = clean_sentences_2['endIdx'][index_in_2]
                    new_sentence['locList2'] = clean_sentences_2['locList'][index_in_2]

            else:
                signs = list(group.values())

                if signs not in [['-', '+', '?'], ['-', '?', '+', '?'], ['-', '?', '+']]:
                    raise Exception('Invalid signs')
                keys = list(group.keys())

                index_in_1 += 1
                index_in_2 += 1

                i1 = keys[0]
                i2 = keys[1] if signs == ['-', '+', '?'] else keys[2]

                new_sentence['clean_sentence'] = diff[i1][2:].strip()
                new_sentence['clean_sentence2'] = diff[i2][2:].strip()
                new_sentence['ids1'] = clean_sentences_1['id'][index_in_1]
                new_sentence['ids2'] = clean_sentences_2['id'][index_in_2]
                new_sentence['section1'] = clean_sentences_1['section'][index_in_1]
                new_sentence['section2'] = clean_sentences_2['section'][index_in_2]
                new_sentence['startIdx1'] = clean_sentences_1['startIdx'][index_in_1]
                new_sentence['startIdx2'] = clean_sentences_2['startIdx'][index_in_2]
                new_sentence['endIdx1'] = clean_sentences_1['endIdx'][index_in_1]
                new_sentence['endIdx2'] = clean_sentences_2['endIdx'][index_in_2]
                new_sentence['locList1'] = clean_sentences_1['locList'][index_in_1]
                new_sentence['locList2'] = clean_sentences_2['locList'][index_in_2]
                new_sentence['status'] = 'modified'
                new_sentence['modifications'] = [diff[keys[2]]] if signs == ['-', '?', '+'] else (
                                        [diff[keys[1]],diff[keys[3]]] if signs == ['-', '?', '+', '?'] else [diff[keys[1]]])


            if new_sentence.get('section1') == 'Lead':
                original_lead += new_sentence['clean_sentence'] + ' '

            all_sentences.append(new_sentence)

        added_sentences = list(filter(lambda x: x['status'] == 'added', all_sentences))
        removed_sentences = list(filter(lambda x: x['status'] == 'removed', all_sentences))

        scores = np.zeros((len(added_sentences), len(removed_sentences)))
        for i, sentence1 in enumerate(added_sentences):
            for j, sentence2 in enumerate(removed_sentences):
                scores[i, j] = compute_sentence_similarity(sentence1['clean_sentence'], sentence2['clean_sentence'])
         

        positions = (np.argsort(-scores, axis=None))
        indices = np.unravel_index(positions, scores.shape)
        index_tuples = list(zip(*indices))
        added_indexes_i = []
        added_indexes_j = []
        filtered_pos = []
        for i,j in index_tuples:
            if i not in added_indexes_i and j not in added_indexes_j:
                filtered_pos.append((i,j))
                added_indexes_i.append(i)
                added_indexes_j.append(j)

 
        for i, j in [pos for pos in filtered_pos if scores[pos] >= 0.6]:
            idx_added = added_sentences[i]['index']
            idx_removed = removed_sentences[j]['index']
            
            if all([i == j for i, j in zip(removed_sentences[j]['ids1'], added_sentences[i]['added_after'])]):
                all_sentences[idx_removed]['status'] = 'modified'
                all_sentences[idx_removed]['ids2'] = added_sentences[i]['ids2']
                all_sentences[idx_removed]['startIdx2'] = added_sentences[i]['startIdx2']
                all_sentences[idx_removed]['endIdx2'] = added_sentences[i]['endIdx2']
                all_sentences[idx_removed]['locList2'] = added_sentences[i]['locList2']
                all_sentences[idx_removed]['section2'] = added_sentences[i]['section2']
                all_sentences[idx_removed]['clean_sentence2'] = added_sentences[i]['clean_sentence']
                all_sentences[idx_added]['status'] = 'to_ignore'
            elif scores[i, j] >= 0.68:
                
                all_sentences[idx_added]['moved_from'] = idx_removed
                all_sentences[idx_removed]['moved_to'] = idx_added
                if scores[i, j] >= 0.99:
                    all_sentences[idx_added]['status'] = 'moved_from'
                    all_sentences[idx_removed]['status'] = 'moved_to'
                else:
                    all_sentences[idx_added]['status'] = 'moved_from_with_modifications'
                    all_sentences[idx_removed]['status'] = 'moved_to_with_modifications'
                    all_sentences[idx_removed]['clean_sentence2'] = added_sentences[i]['clean_sentence']


        section_sentences = {}
        for sentence in all_sentences:
            if sentence['status'] in ['added', 'moved_from','moved_from_with_modifications', 'to_ignore']:
                continue
            if sentence['section1'] not in section_sentences:
                section_sentences[sentence['section1']] = []
            section_sentences[sentence['section1']].append(sentence)

        if all_links_1.shape[0] == 0:
            all_links_1 = pd.DataFrame(columns=all_links_2.columns)

        all_links_1['text'] = all_links_1['text'].apply(lambda x: str(x))
        all_links_2['text'] = all_links_2['text'].apply(lambda x: str(x))

        all_links = all_links_1.merge(all_links_2, on=['link'], how='outer', suffixes=('_1', '_2'))


        added_links = all_links[all_links['sentid_1'].isnull()].copy()

        added_links.drop(columns=['text_1'], inplace=True)
        added_links.rename(columns={'text_2': 'text'}, inplace=True)

        all_sentences2 = list(filter(lambda x: x['status'] not in ['removed', 'moved_to', 'moved_to_with_modifications', 'to_ignore'], all_sentences))

        for _, link in added_links.iterrows():
                        
            sentences = list(filter(lambda x: int(link['sentid_2']) in x['ids2'], all_sentences2))
            
            sentence = list(sentences)[0]

            # get target title
            target_title = fix_target_titles(
                link['link'].split("wiki/")[1].split('#')[0], redirect_1, redirect_2)
            
            all_contexts = create_all_contexts(
                section_sentences, args.side_contexts_size)
        
            section = sentence['section2'] 

            if sentence['status'] == 'neutral':
                missing_category = 'missing_mention'
            elif sentence['status'] == 'moved_from':
                missing_category = 'missing_mention_in_moved_sentence'
            elif section not in section_sentences:
                    missing_category = 'missing_section'  
            elif sentence['status'] == 'modified':
                missing_category = 'missing_mention_with_sentence_modifications'
            elif sentence['status'] == 'moved_from_with_modifications':
                missing_category = 'missing_mention_in_moved_sentence_with_modifications'
            else:
                prev_index = max(sentence['index'] - 1, 0)
                next_index = min(sentence['index'] + 1, len(all_sentences) - 1)
                prev_status = all_sentences[prev_index]['status']
                next_status = all_sentences[next_index]['status']
                if (
                    (prev_status != 'added' or all_sentences[prev_index]['section2'] != section) and
                    (next_status != 'added' or all_sentences[next_index]['section2'] != section)
                    ):
                    missing_category = 'missing_sentence'
                else:
                    missing_category = 'missing_span'
                    
            
            moved_insertion_marker = None

            if missing_category == 'missing_mention' or missing_category == 'missing_mention_with_sentence_modifications':
                insert_index = sentence['ids1']
            elif missing_category == 'missing_sentence' or missing_category == 'missing_span':
                insert_index = sentence['added_after']
            elif missing_category == 'missing_mention_in_moved_sentence' or missing_category == 'missing_mention_in_moved_sentence_with_modifications':
                insert_index = all_sentences[sentence['moved_from']]['ids1']
                moved_insertion_marker = sentence['added_after']
            else: insert_index = None
            
            if missing_category == 'missing_span':
                link_sentence = ''
                i = sentence['index'] - 1
                while i >= 0 and all_sentences[i]['status'] == 'added' and all_sentences[i]['section2'] == section:
                    link_sentence = all_sentences[i]['clean_sentence'] + ' ' + link_sentence
                    i -= 1
                i = sentence['index'] + 1
                link_sentence += sentence['clean_sentence']
                while i < len(all_sentences) and all_sentences[i]['status'] == 'added' and all_sentences[i]['section2'] == section:
                    link_sentence = link_sentence + ' ' + all_sentences[i]['clean_sentence']
                    i += 1

            else:
                link_sentence = sentence['clean_sentence']            

            output.append({
                'source_title': input['source_title'],
                'source_ID': input['source_ID'],
                'target_title': target_title,
                'context': None,
                'insert_indices': insert_index,
                'moved_insertion_marker': moved_insertion_marker,
                'link_sentence': link_sentence,
                'link_text': link['text'],
                'section': section,
                'mention_present': None,
                'source_lead': original_lead.strip(),
                'first_version': input['first_version'],
                'second_version': second_version,
                'direct_match': None,
                'missing_category': missing_category,
                'all_contexts': all_contexts
            })

    return output

def process_files(
    process_func: Callable[[Any], List[Any]], 
    revisions: List[Any], 
    nb_processes: int, 
    initializer: Callable[[], None] = None
) -> List[Any]:
    """
    Processes a list of revisions using a specified processing function, optionally utilizing 
    multiprocessing to speed up the operation.

    This function takes a processing function and a list of revisions, and applies the 
    function to each revision. If the number of processes specified (`nb_processes`) 
    is greater than one, it uses a multiprocessing pool to process the revisions in parallel. 
    If only one process is specified, it processes the revisions sequentially. 

    Args:
        process_func (Callable[[Any], List[Any]]): A function that takes a single revision 
            and returns a list of outputs.
        revisions (List[Any]): A list of revisions to be processed by the `process_func`.
        nb_processes (int): The number of processes to use for parallel processing. 
            If set to 1, processing is done sequentially.
        initializer (Callable[[], None], optional): An optional initializer function that is 
            called when the pool is created. Defaults to None.

    Returns:
        List[Any]: A list of outputs resulting from applying the `process_func` to each revision.

    Notes:
        The output of `process_func` is expected to be either a list or a single output. 
        If it is a single output, it will be wrapped in a list before being extended into 
        the outputs list.
    """
    outputs = []
    if nb_processes > 1:
        pool = Pool(nb_processes, initializer=initializer)
        for result in tqdm(pool.imap(process_func, revisions), total=len(revisions)):
            outputs.extend(result if isinstance(result, list) else [result])
        pool.close()
        pool.join()
    else:
        outputs = [output for revision in tqdm(revisions, total=len(revisions)) for output in process_func(revision)]
    return outputs

if __name__ == '__main__':
    # Create argument parser for command-line inputs
    parser = argparse.ArgumentParser()
    parser.add_argument('--revisions_path', type=str,
                        required=True, help='Path to the revisions file')
    parser.add_argument('--parsed_html_dir', type=str, required=True,
                        help='Path to the directory containing all the parsed HTML files, both links and sentences')
    parser.add_argument('--first_versions_specific_parsed_html_dir', type=str, required=False, default=None)
    parser.add_argument('--n_processes', type=int, required=False, default=1,
                        help='Number of processes to use')
    parser.add_argument('--output_dir', type=str, required=True,
                        help='Path to the output directory')
    parser.add_argument('--side_contexts_size', type=int, required=True,
                        help='Half size of the context') 
    parser.add_argument('--first_version_only', type=bool, default=False,
                        help='If True, only the first version of the article will be processed')
    parser.add_argument('--redirect_1', type=str, required=False,
                        help='Path to the first redirect file')
    parser.add_argument('--redirect_2', type=str, required=False,
                        help='Path to the second redirect file')

    # Parse the command-line arguments
    args = parser.parse_args()

    # Determine if processing versions other than the first
    process_v2 = not args.first_version_only

    # Set the directory for first version HTML files
    if args.first_versions_specific_parsed_html_dir is None:
        first_versions_html_dir = args.parsed_html_dir
    else:
        first_versions_html_dir = args.first_versions_specific_parsed_html_dir

    # Check if input files exist; raise exceptions if they do not
    if not os.path.exists(args.revisions_path):
        print(args.revisions_path)
        raise Exception('Revisions file does not exist')
    if not os.path.exists(args.parsed_html_dir):
        raise Exception(f'parsed HTML directory {args.parsed_html_dir} does not exist')
    if not os.path.exists(first_versions_html_dir):
        raise Exception(f'parsed HTML directory {first_versions_html_dir} does not exist')
    
    # Create the output directory if it does not exist
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)
    
    # Load the revisions data from the specified path
    revisions_clean = pd.read_parquet(args.revisions_path).to_dict(orient='records')
    
    output = []
    # Determine the number of processes to use, limiting it to the number of available CPU cores
    nb_processes = min(cpu_count(), args.n_processes)
    print(f"Running on {nb_processes} processes")
    
    # Process versions if not only the first version is to be processed
    if process_v2:
        # Check if redirect files exist
        if not os.path.exists(args.redirect_1):
            raise Exception('Redirect file 1 does not exist')
        if not os.path.exists(args.redirect_2):
            raise Exception('Redirect file 2 does not exist')

        # Load the redirect files
        redirect_1 = pd.read_parquet(args.redirect_1)
        redirect_2 = pd.read_parquet(args.redirect_2)

        redirect_1 = redirect_1.to_dict()['redirect']
        redirect_2 = redirect_2.to_dict()['redirect']

        # Initializer function for multiprocessing to load redirect data into global scope
        def initializer():
            global redirect_1
            global redirect_2

            redirect_1 = pd.read_parquet(args.redirect_1)
            redirect_2 = pd.read_parquet(args.redirect_2)
            redirect_1 = redirect_1.to_dict()['redirect']
            redirect_2 = redirect_2.to_dict()['redirect']
    
        # Process files using the specified function for two versions
        output = process_files(process_two_versions, revisions_clean, nb_processes, initializer)

    else:
        # Process files using the specified function for the single version
        output = process_files(process_single_version, revisions_clean, nb_processes, output)

    # Print the length of the output for confirmation
    print(f"The length of the output is {len(output)}")

    # Convert the output list to a DataFrame for further processing
    df_output = pd.DataFrame(output)

    # Clean up the source lead text in the output DataFrame
    df_output['source_lead'] = df_output['source_lead'].progress_apply(fix_text)
    
    # Save the processed DataFrame to a Parquet file in the output directory
    df_output.to_parquet(os.path.join(args.output_dir, f'test_data.parquet'))


