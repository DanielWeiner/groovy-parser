import { Token, SyntaxNode, Terminal, Nonterminal, RawPostprocessorArg, concat } from './ast'
import type { Postprocessor as NearleyPostprocessor } from 'nearley';
export type Postprocessor = (...args: Parameters<NearleyPostprocessor>) => any;
import { AstSpanProvider } from './span';
type NodeProviderFn = () => AstNodeProvider;
interface NodeConfig {
    name: string;
    text?: boolean;
}

function hasReject(arg: RawPostprocessorArg, reject: {}): boolean {
    if (arg === reject) return true;
    if (arg === null || arg === undefined) return false;
    if (!(Symbol.iterator in arg)) return false;
    for (const value of arg) if (hasReject(value, reject)) return true;
    return false;
}

const createTerminal = (kind: string, token: Token, offset: number, length: number): Terminal => ({
    nodeType: 'terminal',
    kind,
    offset,
    length,
    token,
});

const createNonterminal = (kind: string, parts: SyntaxNode[], offset: number, length: number): Nonterminal => ({
    nodeType: 'nonterminal',
    kind,
    offset,
    length,
    parts
});

const takeAll: Postprocessor = ((args: any[] = []) => concat(args)) as Postprocessor;

export class AstNodeProvider {
    #spanProvider: AstSpanProvider;

    constructor(spanProvider: AstSpanProvider) {
        this.#spanProvider = spanProvider;
    }

    static terminal = (getNodeProvider: NodeProviderFn): AstNodeProvider['terminal'] => (...args) => (...nearleyArgs) => getNodeProvider().terminal(...args)(...nearleyArgs);
    static nonterminal = (getNodeProvider: NodeProviderFn): AstNodeProvider['nonterminal'] => (...args) => (...nearleyArgs) => getNodeProvider().nonterminal(...args)(...nearleyArgs);

    terminal(config: string | NodeConfig): Postprocessor {
        return ([tokenOrTokens]: (Token[]|Token)[] = []) => {
            if (!tokenOrTokens) return null;
            const name = typeof config === 'string' ? config : config.name;
            const token = [tokenOrTokens].flat(Infinity)[0]! as Token;
            const { offset, length } = this.#spanProvider.getSpan(token) ?? { offset: 0, length: 0 };  
            return createTerminal(name, token, offset, length);
        };
    }

    nonterminal(config: string | NodeConfig, transform: Postprocessor = takeAll): Postprocessor {
        return (elements, loc, reject) => {
            const transformed = [...concat(transform(elements, loc, reject))];
            if (hasReject(transformed, reject!)) return reject; 
            const name = typeof config === 'string' ? config : config.name;
            const { offset, length } = this.#spanProvider.getSpan(transformed) ?? { offset: 0, length: 0 };
            return createNonterminal(name, transformed, offset, length);
        }
    }
}
