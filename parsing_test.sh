# set default values
input_dir="/dlabdata1/tsoares/wikidumps/"
output_dir="/dlabdata1/boulenge/wikidumps_data"
processes=1


while [ : ]; do
    case "$1" in
        --langs) langs=$2; shift 2;;
        --input_dir) input_dir=$2; shift 2;;
        --output_dir) output_dir=$2; shift 2;;
        --processes) processes=$2; shift 2;;
        --) shift; break;;
        *) break;;
    esac
done

# check if any argument is missing

if [[ -z $langs || -z $input_dir || -z $output_dir || -z $processes ]]; then
    echo "Missing arguments!"
    echo "Usage: $0 --langs <langs> --data_dir <input_dir> --output_dir <output_dir> --processes <processes>"
    echo "Options:"
    echo "langs: Languages of the wikipedia dump"
    echo "input_dir: Directory of the raw data"
    echo "output_dir: where to store the processed data"
    echo "processes: Number of processes to use when using multiprocessing"
    exit 1
fi

first_month=20230901
second_month=20231001
third_month=20231101

# print the options to the user
echo "Languages: $langs"
echo "Input Directory: $input_dir"
echo "Output Directory: $output_dir"
echo "Number of Processes: $processes"
echo "First Month: $first_month"
echo "Second Month: $second_month"
echo "Third Month: $third_month"

echo "Parsing HTMLs"
for lang in $langs; do
    echo "Processing $lang"
    python parsing.py \
        --versions_file ${input_dir}/${lang}wiki-NS0-${second_month}/eval/link_versions \
        --html_dir ${input_dir}/${lang}wiki-NS0-${second_month}/eval/pages \
        --redirect_1 ${input_dir}/${lang}wiki-NS0-${second_month}/processed_data/redirect_map.parquet \
        --redirect_2 ${input_dir}/${lang}wiki-NS0-${third_month}/processed_data/redirect_map.parquet \
        --mention_map ${input_dir}/${lang}wiki-NS0-${second_month}/processed_data/mention_map.parquet \
        --output_dir ${output_dir}/parsed_htmls/${lang} \
        --n_processes $processes
done
