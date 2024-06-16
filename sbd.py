





    args = parser.parse_args()
    lang = args.lang

    if not os.path.exists(args.full_texts_dir):
        raise Exception(f'Full texts directory {args.full_texts_dir} does not exist')
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir, exist_ok=True)

    

