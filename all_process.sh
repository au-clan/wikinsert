#!/bin/bash

# set default values
raw_data_dir="/dlabdata1/tsoares/wikidumps/"
processed_data_dir="/dlabdata1/boulenge/wikidumps_data"
processes=48
max_samples_per_lang=250


while [ : ]; do
    case "$1" in
        --langs) langs=$2; shift 2;;
        --side_context_sizes) side_context_sizes=$2; shift 2;;
        --raw_data_dir) raw_data_dir=$2; shift 2;;
        --processed_data_dir) processed_data_dir=$2; shift 2;;
        --processes) processes=$2; shift 2;;
        --max_samples_per_lang) max_samples_per_lang=$2; shift 2;;
        --) shift; break;;
        *) break;;
    esac
done

# check if any argument is missing

if [[ -z $langs || -z $side_context_sizes || -z $raw_data_dir || -z $processed_data_dir || -z $processes || -z $max_samples_per_lang ]]; then
    echo "Missing arguments!"
    echo "Usage: $0 --langs <langs> --side_context_sizes <sizes> --data_dir <raw_data_dir> --processed_data_dir <processed_data_dir> --processes <processes>"
    echo "Options:"
    echo "langs: Languages of the wikipedia dump"
    echo "side_context_sizes: sizes of a half context"
    echo "raw_data_dir: Directory of the raw data"
    echo "processed_data_dir: where to store the processed data"
    echo "processes: Number of processes to use when using multiprocessing"
    echo "max_samples_per_lang: Maximum number of samples per lang (and context_size)"
    exit 1
fi

second_month=20231001
third_month=20231101

# print the options to the user
echo "Languages: $langs"
echo "Side Context Sizes: $side_context_sizes"
echo "Input Directory: $raw_data_dir"
echo "Output Directory: $processed_data_dir"
echo "Number of Processes: $processes"
echo "Second Month: $second_month"
echo "Third Month: $third_month"

echo "Preparing Parsing"

rev_files_dir="${processed_data_dir}/revisions_files"

# Check if the directory does not exist
if [ ! -d "$rev_files_dir" ]; then
    # Create the directory
    mkdir -p "$rev_files_dir"
fi

#: <<'COMMENT_BLOCK'
for lang in $langs; do
    echo "Processing $lang"
    python prepare_parsing.py \
        --versions_file ${raw_data_dir}/${lang}wiki-NS0-${second_month}/eval/link_versions \
        --html_dir ${raw_data_dir}/${lang}wiki-NS0-${second_month}/eval/pages \
        --redirect_1 ${raw_data_dir}/${lang}wiki-NS0-${second_month}/processed_data/redirect_map.parquet \
        --redirect_2 ${raw_data_dir}/${lang}wiki-NS0-${third_month}/processed_data/redirect_map.parquet \
        --mention_map ${raw_data_dir}/${lang}wiki-NS0-${second_month}/processed_data/mention_map.parquet \
        --max_samples $max_samples_per_lang \
        --save_path ${rev_files_dir}/revisions_${lang}.parquet
done

echo "Parsing htmls"
for lang in $langs; do
    echo "Processing $lang"
    python parsing.py \
        --revisions_path ${processed_data_dir}/revisions_files/revisions_${lang}.parquet \
        --html_dir ${raw_data_dir}/${lang}wiki-NS0-${second_month}/eval/pages \
        --output_dir ${processed_data_dir}/parsed_htmls/${lang} \
        --n_processes $processes
done



echo "Generating Test data"
for lang in $langs; do
    for side_context_size in $side_context_sizes; do
        echo "Processing $lang with side context size $side_context_size"
        python modular_preprocessing.py \
            --revisions_path ${processed_data_dir}/revisions_files/revisions_${lang}.parquet \
            --parsed_html_dir ${processed_data_dir}/parsed_htmls/${lang} \
            --redirect_1 ${raw_data_dir}/${lang}wiki-NS0-${second_month}/processed_data/redirect_map.parquet \
            --redirect_2 ${raw_data_dir}/${lang}wiki-NS0-${third_month}/processed_data/redirect_map.parquet \
            --mention_map ${raw_data_dir}/${lang}wiki-NS0-${second_month}/processed_data/mention_map.parquet \
            --output_dir ${processed_data_dir}/contexts_splitted_data/${lang}/context_size_${side_context_size} \
            --side_contexts_size $side_context_size \
            --n_processes $processes
    done
done

echo "Process test data for scoring"

python modular_merge_data.py \
    --test_data_dir ${processed_data_dir}/contexts_splitted_data/ \
    --raw_data_dir ${raw_data_dir}/ \
    --langs $langs \
    --side_contexts_sizes $side_context_sizes \
    --output_dir ${processed_data_dir}/ready_to_score_data \
    --ignore_warnings

#COMMENT_BLOCK
echo "Score all contexts"

python get_scores.py \
    --data_dir ${processed_data_dir}/ready_to_score_data \
    --output_dir ${processed_data_dir}/scored_data \
    --langs $langs \
    --side_contexts_sizes $side_context_sizes \
    --models_dir /dlabdata1/tsoares/models \
    --models_prefix roberta_full \
    --use_section_title \
    --use_mentions \
    --use_cuda \
    --only_multilingual \
    --multilingual_name multilingual-all


echo "Over"

# End of script