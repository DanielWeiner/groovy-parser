import { readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";
import * as nearley from "nearley";
import grammar, { setParseTreeNodeProvider } from "./groovy.ne";
import { EOL } from "node:os";
import { md5 } from "./stringUtils";
import { ParseTreeNodeProvider } from './parseTreeNodeProvider';
import { SyntaxTreeBuilder } from './syntaxTree';
import { ParseTreeSpanProvider } from "./parseTreeSpanProvider";

const INPUT_PATH = path.join(__dirname, "..", "sandbox", "input.txt");
const OUTPUT_PATH = path.join(__dirname, "..", "sandbox", "output.json");
const WARNINGS_PATH = path.join(__dirname, "..", "sandbox", "warnings.txt");

type Result = {
    time: string;
    parsingDurationMs: number;
    warnings: string[];
    treeCount: number;
    uniqueTreeCount: number;
    trees: {
        count: number;
        tree: any;
    }[];
    error?: string[];
}

type Inputs = {
    text: string;
    warnings: string[];
}

type Output = {
    result: Result;
    message: string;
}

type ParseResult = {
    results: any[];
    error: any;
    time: Date;
    duration: number;
}

function parse(input: string): ParseResult {
    const nearleyGrammar = nearley.Grammar.fromCompiled(grammar);
    const parser = new nearley.Parser(nearleyGrammar);
    const result: ParseResult = {
        results: [],
        error: null,
        time: new Date(),
        duration: 0
    };
    const now = performance.now();
    try {
        result.results = parser.feed(input).results;
    } catch (err: any) {
        result.error = err;
    } finally {
        result.duration = performance.now() - now;
        result.time = new Date();
        return result;
    }
}

function hashObj(obj: any): string {
    return md5(JSON.stringify(obj));
}

function formatObj(obj: any): string {
    return JSON.stringify(obj, null, 2);
}

function formatMessage(time: Date, message: string): string {
    return `[${time.toISOString()}] ${message}`;
}

function generateParseOutput(input: string, warnings: string[], nodeProvider: ParseTreeNodeProvider): Output {
    setParseTreeNodeProvider(nodeProvider);
    const { results, error, time, duration } = parse(input);
    const hashes = new Map<string, any>();
    const counts = new Map<string, number>();
    for (const result of results) {
        const hash = hashObj(result);
        hashes.set(hash, result);
        counts.set(hash, (counts.get(hash) || 0) + 1);
    }
    const uniqueResults = hashes.entries()
                                .map(([hash, tree]) => ({
                                    count: counts.get(hash) || 0,
                                    tree
                                }))
                                .take(10)
                                .toArray();
    const result: Result = {
            time: new Date(time).toISOString(),
            parsingDurationMs: +duration.toFixed(3),
            warnings: warnings,
            treeCount: results.length,
            uniqueTreeCount: uniqueResults.length,
            trees: uniqueResults,
            ...error ? { error: error.stack.toString().split(EOL).filter((line: string) => line.trim() !== '') } : {}
        };
    const message = error 
        ? formatMessage(time, `Parsing failed: ${error.stack}`) 
        : formatMessage(time, `Parsing successful after ${duration.toFixed(2)} ms`);
    return {
        result,
        message
    }
}

async function getInputs(): Promise<Inputs> {
    const [text, warningsTxt] = await Promise.all([
        readFile(INPUT_PATH, { encoding: 'utf-8' }),
        readFile(WARNINGS_PATH, { encoding: 'utf-8' }),
    ]);
   
    const warnings = warningsTxt.split(EOL).filter(line => line.trim() !== '');
    return { text, warnings };
}



async function main() {
    const { text, warnings } = await getInputs();
    const spanProvider = new ParseTreeSpanProvider(text);
    const nodeProvider = new ParseTreeNodeProvider(spanProvider);
    const treeBuilder = new SyntaxTreeBuilder(spanProvider);
    const { result, message } = generateParseOutput(text, warnings, nodeProvider);
    const fileOutput = formatObj({
        ...result,
        trees: result.trees.map(({ count, tree }) => ({
            count,
            tree: treeBuilder.buildTree(tree)
        }))
    });
    process[result.error ? "stderr" : "stdout"].write(message + EOL);
    await writeFile(OUTPUT_PATH, fileOutput);
}

main();

export {}