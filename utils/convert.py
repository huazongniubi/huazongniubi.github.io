import argparse
import codecs
import json
from collections import defaultdict # Import defaultdict

import pandas as pd


def get_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument('-q', '--question', nargs='+', type=str,
                        help='set <input.csv> (required) and <output.js> (optional, \"questions.js\" by default)',
                        metavar=('input.csv', 'output.js'))
    return parser


def convert_question(input: str, output: str = 'questions.js'):
    axes_name_to_id = {
        '政治华学': 'iHua',
        '修仙华学': 'GodHua',
        '地上华学': 'abstract',
        '商务华学': 'business',
        '理论华学': 'theory',
        '计算华学': 'calcul',
        '历史华学': 'history',
        '相对华学': 'relativity'
    }

    # Keep track of counts for each axis to generate unique IDs
    axis_counts = defaultdict(int) # Use defaultdict for convenience

    # 读取CSV文件
    try:
        df = pd.read_csv(input)
    except FileNotFoundError:
        print(f"错误: 输入文件 '{input}' 未找到。")
        return
    except Exception as e:
        print(f"错误: 读取 CSV 文件时出错: {e}")
        return

    questions = []

    # 遍历每一行
    for index, row in df.iterrows():
        # 跳过题目为空的行
        if pd.isna(row['题目']):
            continue

        # 获取维度和分值
        dimension = row['坐标轴']
        score_str = row['分值'] # Keep score as string initially for validation

        # 检查维度是否有效
        if dimension not in axes_name_to_id:
            print(f"警告: 第 {index + 2} 行跳过无效维度 '{dimension}'")
            continue

        axis_id = axes_name_to_id[dimension]

        # 检查分值是否有效
        try:
            score = int(score_str)
        except (ValueError, TypeError):
             print(f"警告: 第 {index + 2} 行跳过无效分值 '{score_str}' (维度: {dimension})")
             continue

        # Increment count for this axis and generate ID
        axis_counts[axis_id] += 1
        question_id = f"{axis_id}_{axis_counts[axis_id]}"

        # 创建问题对象
        item = {
            'id': question_id, # Add the generated ID
            'question': row['题目'],
            'effect': {
                axis_id: score
            }
        }
        questions.append(item)


    # 转换为JavaScript格式并写入文件
    json_str = json.dumps(questions, ensure_ascii=False, indent=4)
    try:
        with codecs.open(output, 'w', encoding='utf-8') as f:
            f.write('questions = ' + json_str + ';\n')
        print(f"成功将问题写入 '{output}'")
    except Exception as e:
        print(f"错误: 写入 JavaScript 文件时出错: {e}")


if __name__ == '__main__':
    parser = get_parser()
    args = vars(parser.parse_args())
    if not any(args.values()):
        parser.print_help()
    if args['question'] is not None:
        question_args = args['question']
        if 1 <= len(question_args) <= 2:
            convert_question(*question_args)
        else:
            parser.error('argument -q/--question: expected 1 or 2 arguments')
