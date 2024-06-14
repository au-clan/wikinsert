from nltk.tokenize import sent_tokenize
import sys
import json

def nltk_sbd(text, lang='english'):
    return sent_tokenize(text, language=lang)

if __name__ == '__main__':
    text = sys.argv[1]
    print(json.dumps(main(text)))

