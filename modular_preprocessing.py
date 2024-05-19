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




UNRELEVENT_SECTIONS = ["References", "Other Websites"]

warnings.filterwarnings("ignore", category=MarkupResemblesLocatorWarning)

def fix_target_titles(title, redirect_map_1, redirect_map_2):
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

def clean_condition(txt):
    # don't allow sentences with less than 10 characters adn non sentence like
    return True #len(txt) > 50 or (len(txt) > 10 and txt[-1] in ['.', '!', '?', ']', ':', ';']) 

def merge_sentences(row1, row2):
    row = {}
    row['text'] = row1['text'] + '. ' + row2['text'] 
    row['id'] = row1['id'] + row2['id'] #concat list of ids
    row['startIdx'] = row1['startIdx']
    row['endIdx'] = row2['endIdx']
    row['section'] = row1['section'] #section is the same
    row['locList'] = row1['locList'] + row2['locList'] #concat list of locations

    return row

def compute_sentence_similarity(sentence1, sentence2):
    words1 = [word.strip() for word in sentence1.replace('\n', ' ').split(' ') if word != '']
    words2 = [word.strip() for word in sentence2.replace('\n', ' ').split(' ') if word != '']
    
    freqs1 = Counter(words1)
    freqs2 = Counter(words2)
    norm1 = math.sqrt(sum([freqs1[word]**2 for word in freqs1]))
    norm2 = math.sqrt(sum([freqs2[word]**2 for word in freqs2]))
    
    dot_product = sum(freqs1[word] * freqs2[word] for word in freqs1 if word in freqs2)
    score = dot_product / (norm1 * norm2)  
    return score

def clean_sentences(sentences_df):
    new_sentences = []
    current_unclean = None 
    sentences_df['id'] = sentences_df['id'].apply(lambda x: [x])
    sentences_df['text'] = sentences_df['text'].apply(lambda x: x.strip())

    for _, row in sentences_df.iterrows():
        if row['section'] in UNRELEVENT_SECTIONS:
            continue
        if row['text'] == '':
            continue

        row = row.to_dict()
        if current_unclean is None:
            if clean_condition(row['text']):
                new_sentences.append(row)
            else:
                current_unclean = row
        elif current_unclean['section'] == row['section']:
            current_unclean = merge_sentences(current_unclean, row)
            if clean_condition(current_unclean['text']):
                new_sentences.append(current_unclean)
                current_unclean = None
        else:
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
    
    if current_unclean is not None:
        new_sentences.append(current_unclean)
        

    return pd.DataFrame(new_sentences).reset_index()

def fix_text(text):
    text = text.strip()
    text = re.sub(' +', ' ', text)
    text = re.sub('\n+', '\n', text)
    text = re.sub('\n +', '\n', text)
    return text

def create_all_contexts(section_sentences, side_contexts_size):
    contexts = []
    for section in section_sentences:
        curr_sentences = section_sentences[section]
        for i, sentence in enumerate(section_sentences[section]):
            min_index = max(0, i - side_contexts_size)
            max_index = min(len(curr_sentences), i + side_contexts_size + 1)
            context = " ".join([s['clean_sentence']
                                for s in curr_sentences[min_index:max_index]]).strip()
            contexts.append({'context': context, 'middle_sentence': sentence, 'section': section})

    return contexts

def get_group_indexes(diff):
    spe_indexes = [i for i, line in enumerate(diff) if line.startswith('?')]
    all_starts = [line[0] for line in diff]

    group_indexes = []
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
                group_indexes.append({idx-2 : '-', idx-1 : '+', idx : '?'})
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
                raise Exception('-? att the end')
            if all_starts[idx+1] == ' ':
                raise Exception('Space after -?')
            if all_starts[idx+1] == '-':
                raise Exception('- -?')
            
            if all_starts[idx+1] == '+':
                if idx == len(diff) - 2:
                    group_indexes.extend({j: all_starts[j]} for j in range(last_added+1, idx-1))
                    group_indexes.append({idx-1: '-', idx : '?', idx+1 : '+'})
                    last_added = idx+1
                    continue
                
                if all_starts[idx+2] == '?':
                    group_indexes.extend({j: all_starts[j]} for j in range(last_added+1, idx-1))
                    group_indexes.append({idx-1: '-', idx : '?', idx+1 : '+', idx+2 : '?'})
                    last_added = idx+2
                    continue
                else:
                    group_indexes.extend({j: all_starts[j]} for j in range(last_added+1, idx-1))
                    group_indexes.append({idx-1: '-', idx : '?', idx+1 : '+'})
                    last_added = idx+1
                    continue
    
    if last_added != len(diff) - 1:
        group_indexes.extend({j: all_starts[j]} for j in range(last_added+1, len(diff)))

    return group_indexes
    

def process_version(input):
    
    output = []
    d = difflib.Differ()
    sentences_1_path = os.path.join(
        args.parsed_html_dir, f"{input['source_ID']}_{input['first_version']}_sentences.jsonl")
    
    links_1_path = os.path.join(
        args.parsed_html_dir, f"{input['source_ID']}_{input['first_version']}_links.jsonl")

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
        print('No sentences found')
        print(f"{input['source_ID']}_{input['first_version']}_sentences.jsonl")
        return []
    
    all_links_1 = pd.read_json(links_1_path)

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
            print('No sentences found')
            print(f"{input['source_ID']}_{second_version}_sentences.jsonl")
            continue

        all_links_2 = pd.read_json(links_2_path)        

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

        all_links = all_links_1.merge(all_links_2, on=['text'], how='outer', suffixes=('_1', '_2'))


        added_links = all_links[all_links['sentid_1'].isnull()].copy()

        added_links.drop(columns=['link_1'], inplace=True)
        added_links.rename(columns={'link_2': 'link'}, inplace=True)

        all_sentences2 = list(filter(lambda x: x['status'] not in ['removed', 'moved_to', 'moved_to_with_modifications', 'to_ignore'], all_sentences))

        for _, link in added_links.iterrows():
            
            if link['section_2'] in UNRELEVENT_SECTIONS:
                continue
            
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
                print(all_sentences[sentence['moved_from']])
                print(sentence)
                print("==========")
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


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--revisions_path', type=str,
                        required=True, help='Path to the revisions file')
    parser.add_argument('--parsed_html_dir', type=str, required=True,
                        help='Path to the directory containing all the parsed HTML files, both links and sentences')
    parser.add_argument('--redirect_1', type=str, required=True,
                        help='Path to the first redirect file')
    parser.add_argument('--redirect_2', type=str, required=True,
                        help='Path to the second redirect file')
    parser.add_argument('--mention_map', type=str, required=True,
                        help='Path to the mention map file')
    parser.add_argument('--output_dir', type=str, required=True,
                        help='Path to the output directory')
    parser.add_argument('--side_contexts_size', type=int, required=True,
                        help='Half size of the context')
    parser.add_argument('--n_processes', type=int, default=1,
                        help='Number of processes to use')

    args = parser.parse_args()

    # check if input files exist
    if not os.path.exists(args.revisions_path):
        print(args.revisions_path)
        raise Exception('Revisions file does not exist')
    if not os.path.exists(args.parsed_html_dir):
        raise Exception(f'parsed HTML directory {args.parsed_html_dir} does not exist')
    if not os.path.exists(args.redirect_1):
        raise Exception('Redirect file 1 does not exist')
    if not os.path.exists(args.redirect_2):
        raise Exception('Redirect file 2 does not exist')
    if not os.path.exists(args.mention_map):
        raise Exception('Mention map file does not exist')

    # create the output directory if it does not exist
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)

    # load the data
    redirect_1 = pd.read_parquet(args.redirect_1)
    redirect_2 = pd.read_parquet(args.redirect_2)

    redirect_1 = redirect_1.to_dict()['redirect']
    redirect_2 = redirect_2.to_dict()['redirect']

    revisions_clean = pd.read_parquet(args.revisions_path).to_dict(orient='records')

    def initializer():
        global redirect_1
        global redirect_2
        global mentions_map

        redirect_1 = pd.read_parquet(args.redirect_1)
        redirect_2 = pd.read_parquet(args.redirect_2)
        redirect_1 = redirect_1.to_dict()['redirect']
        redirect_2 = redirect_2.to_dict()['redirect']

        mentions_map_pre = pd.read_parquet(args.mention_map)
        mentions_map_pre = mentions_map_pre.to_dict(orient='records')
        mentions_map = {}
        for row in mentions_map_pre:
            target_title = fix_target_titles(
                row['target_title'], redirect_1, redirect_2)
            if target_title not in mentions_map:
                mentions_map[target_title] = [row['mention']]
            else:
                mentions_map[target_title].append(row['mention'])
    
    output = []
    nb_processes_ = min(cpu_count(), args.n_processes)
    print(f"Running on {nb_processes_} processes")
    pool = Pool(nb_processes_, initializer=initializer)
    print("Parallel multiprocess")
    for result in tqdm(pool.imap(process_version, revisions_clean), total=len(revisions_clean)):
        output.extend(result)
    pool.close()
    pool.join()

    

    '''for i in range(0, len(output), 100_000):
        df_output = pd.DataFrame(output[i:i+100_000])
        df_output['context'] = df_output['context'].progress_apply(fix_text)
        df_output['source_lead'] = df_output['source_lead'].progress_apply(
            fix_text)
        df_output.to_parquet(os.path.join(args.output_dir, f'test_data_{i}.parquet'))'''
    
    print(f"The length of the output is {len(output)}")

    df_output = pd.DataFrame(output)

    df_output['source_lead'] = df_output['source_lead'].progress_apply(
        fix_text)
    

    df_output.to_parquet(os.path.join(args.output_dir, f'test_data.parquet'))
