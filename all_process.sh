#!/bin/bash

# set default values
input_dir="/dlabdata1/tsoares/wikidumps/"
output_dir="/dlabdata1/boulenge/wikidumps_data"
processes=64
max_samples_per_lang=1000


while [ : ]; do
    case "$1" in
        --langs) langs=$2; shift 2;;
        --side_context_sizes) side_context_sizes=$2; shift 2;;
        --input_dir) input_dir=$2; shift 2;;
        --output_dir) output_dir=$2; shift 2;;
        --processes) processes=$2; shift 2;;
        --max_samples_per_lang) max_samples_per_lang=$2; shift 2;;
        --) shift; break;;
        *) break;;
    esac
done

# check if any argument is missing

if [[ -z $langs || -z $side_context_sizes || -z $input_dir || -z $output_dir || -z $processes || -z $max_samples_per_lang ]]; then
    echo "Missing arguments!"
    echo "Usage: $0 --langs <langs> --side_context_sizes <sizes> --data_dir <input_dir> --output_dir <output_dir> --processes <processes>"
    echo "Options:"
    echo "langs: Languages of the wikipedia dump"
    echo "side_context_sizes: sizes of a half context"
    echo "input_dir: Directory of the raw data"
    echo "output_dir: where to store the processed data"
    echo "processes: Number of processes to use when using multiprocessing"
    echo "max_samples_per_lang: Maximum number of samples per lang (and context_size)"
    exit 1
fi

first_month=20230901
second_month=20231001
third_month=20231101

# print the options to the user
echo "Languages: $langs"
echo "Side Context Sizes: $side_context_sizes"
echo "Input Directory: $input_dir"
echo "Output Directory: $output_dir"
echo "Number of Processes: $processes"
echo "First Month: $first_month"
echo "Second Month: $second_month"
echo "Third Month: $third_month"

echo "Generating Test data"
for lang in $langs; do
    for side_context_size in $side_context_sizes; do
        echo "Processing $lang with side context size $side_context_size"
        python modular_preprocessing.py \
            --versions_file ${input_dir}/${lang}wiki-NS0-${second_month}/eval/link_versions \
            --html_dir ${input_dir}/${lang}wiki-NS0-${second_month}/eval/pages \
            --redirect_1 ${input_dir}/${lang}wiki-NS0-${second_month}/processed_data/redirect_map.parquet \
            --redirect_2 ${input_dir}/${lang}wiki-NS0-${third_month}/processed_data/redirect_map.parquet \
            --mention_map ${input_dir}/${lang}wiki-NS0-${second_month}/processed_data/mention_map.parquet \
            --output_dir ${output_dir}/multi_context_data/${lang}/context_size_${side_context_size} \
            --side_contexts_size $side_context_size \
            --n_processes $processes
    done
done

echo "Process test data for scoring"

python modular_merge_data.py \
    --test_data_dir ${output_dir}/multi_context_data/ \
    --raw_data_dir ${input_dir}/ \
    --langs $langs \
    --side_contexts_sizes $side_context_sizes \
    --output_dir ${output_dir}/ready_to_score_data \
    --max_samples_per_lang $max_samples_per_lang \
    --ignore_warnings

echo "Score all contexts"

python get_scores.py \
    --data_dir ${output_dir}/ready_to_score_data \
    --output_dir ${output_dir}/scored_data \
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