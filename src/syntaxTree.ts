import { Nonterminal, isNonterminal, getNodeOfKindLeftPosition, isTerminal, SyntaxNode, isToken } from "./parseTree";
import { ParseTreeSpanProvider } from "./parseTreeSpanProvider";

interface SyntaxTreeNode {
    kind: string;
    offset: number;
    length: number;
    text: string;
}

type PackageDeclarationNode = SyntaxTreeNode & {
    name: string;
}

type ImportDeclarationNode = SyntaxTreeNode & {
    name: string;
    spread: boolean;
}

type StatementNode = SyntaxTreeNode & {
    kind: string;
}

type PathExpressionNode = SyntaxTreeNode & {
    primary: SyntaxTreeNode;
    parts: SyntaxTreeNode[]
}
type VariableDeclaratorNode = SyntaxTreeNode & {
    variable: SyntaxTreeNode;
    initializer: SyntaxTreeNode | null;
}
type VariableDeclarationNode = SyntaxTreeNode & {
    modifiers: SyntaxTreeNode[];
    type: SyntaxTreeNode;
    declarators: SyntaxTreeNode[];
}

type ParExpressionNode = SyntaxTreeNode & {
    expression: SyntaxTreeNode
}

type ClosureNode = SyntaxTreeNode & {
    parameters: SyntaxTreeNode[];
    statements: SyntaxTreeNode[];
}

type AssignmentExpressionNode = SyntaxTreeNode & {
    target: SyntaxTreeNode;
    operator: SyntaxTreeNode;
    value: SyntaxTreeNode;
}

type BinaryOperationExpressionNode = SyntaxTreeNode & {
    left: SyntaxTreeNode;
    operator: SyntaxTreeNode;
    right:  SyntaxTreeNode;
}

type CommandExpressionNode = SyntaxTreeNode;

type ProgramNode = {
    packageDeclaration: PackageDeclarationNode | null;
    importDeclarations: ImportDeclarationNode[];
    statements: StatementNode[];
}

const isNode = (kind: string) => (node: SyntaxNode) => !isToken(node) && node.kind === kind;
const isTerminalWithToken = (type: string) => (node: SyntaxNode) => isTerminal(node) && node.token.type === type;
export class SyntaxTreeBuilder {
    readonly #spanProvider: ParseTreeSpanProvider;
    constructor(spanProvider: ParseTreeSpanProvider) {
        this.#spanProvider = spanProvider;
    }

    #buildSpan(kind: string, nodes: SyntaxNode[]): SyntaxTreeNode {
        const { offset, length } = this.#spanProvider.getSpan(nodes)!
        const text = this.#spanProvider.getText(offset, length);
        return {
            kind,
            offset,
            length,
            text
        };
    }

    #buildDefaultNode<T extends SyntaxTreeNode>(tree: SyntaxNode, ext?: Partial<T>): T {
        if (isToken(tree)) {
            return {
                kind: 'token',
                offset: tree.offset,
                length: tree.text.length,
                text: tree.text,
                ...ext ?? {},
            } as T;
        }
        
        return {
            kind: tree.kind,
            ...ext ?? {},
            offset: tree.offset,
            length: tree.length,
            text: this.#spanProvider.getNodeText(tree),
        } as T;
    }
    
    #build(tree: SyntaxNode): SyntaxTreeNode {
        if (isToken(tree) || isTerminal(tree)) return this.#buildDefaultNode(tree);
        switch (tree.kind) {
            case 'commandExpression':
                return this.#buildCommandExpression(tree);
            case 'statement':
                return this.#buildStatement(tree);
            case 'importDeclaration':
                return this.#buildImportDeclaration(tree);
            case 'packageDeclaration':
                return this.#buildPackageDeclaration(tree) || (() => { throw new Error(`Failed to build package declaration node from tree: ${JSON.stringify(tree)}`) })();
            case 'pathExpression':
                return this.#buildPathExpression(tree);
            case 'primary':
                return this.#buildPrimary(tree);
            case 'closure':
                return this.#buildClosure(tree);
            case 'localVariableDeclaration':
                return this.#buildLocalVariableDeclaration(tree);
            case 'variableDeclarator':
                return this.#buildVariableDeclarator(tree);
            case 'parExpression':
                return this.#buildParExpression(tree);
            case 'assignmentExpression':
                return this.#buildAssignmentExpression(tree);
            case 'arithmeticExpression':
            case 'impliesExpression':
            case 'logicalOrExpression':
            case 'logicalAndExpression':
            case 'bitwiseOrExpression':
            case 'bitwiseAndExpression':
            case 'exclusiveOrExpression':
            case 'elvisExpression':
            case 'regexExpression':
            case 'typeExpression':
            case 'booleanRelationalExpression':
            case 'shiftExpression':
            case 'rangeExpression':
            case 'powerExpression':
                return this.#buildBinaryOperationExpression(tree);
            default:
                return this.#buildDefaultNode(tree);
        }
    }

    #buildBinaryOperationExpression(tree: Nonterminal): BinaryOperationExpressionNode {
        const [left, operator, right] = tree.parts as [SyntaxNode, SyntaxNode, SyntaxNode];

        return this.#buildDefaultNode(tree, {
            left: this.#build(left),
            operator: this.#build(operator),
            right: this.#build(right)
        } as BinaryOperationExpressionNode)
    }


    #buildParExpression(tree: Nonterminal): ParExpressionNode {
        const expr = tree.parts[1];
        if (!expr) return this.#buildDefaultNode(tree);

        return this.#buildDefaultNode(tree, {
            expression: this.#build(expr)
        } as ParExpressionNode);
    }

    #buildAssignmentExpression(tree: Nonterminal): AssignmentExpressionNode {
        const [target, operator, operand] = tree.parts as [SyntaxNode, SyntaxNode, SyntaxNode];
        return this.#buildDefaultNode(tree, {
            target: this.#build(target),
            operator: this.#build(operator),
            value: this.#build(operand)
        } as AssignmentExpressionNode);
    }

    #buildVariableDeclarator(tree: Nonterminal): VariableDeclaratorNode {
        const [variable, assign, initializer] = tree.parts;
        if (!assign || !isNonterminal(initializer)) {
            return this.#buildDefaultNode(tree, {
                variable: this.#build(variable!),
                initializer: null
            } as VariableDeclaratorNode);
        }
        return this.#buildDefaultNode(tree, {
            variable: this.#build(variable!),
            initializer: this.#build(initializer!.parts[0]!)
        } as VariableDeclaratorNode);
    }

    #buildLocalVariableDeclaration(tree: Nonterminal): VariableDeclarationNode {
        type VariableDeclarationBuildState = { 
            type: SyntaxTreeNode | null;
            declarators:SyntaxTreeNode[];
            modifiers: SyntaxTreeNode[];
        }
        
        const { declarators, modifiers, type } = tree.parts.values().reduce(({ type, declarators, modifiers }, part): VariableDeclarationBuildState => {
            const nodeOfKind = getNodeOfKindLeftPosition(part, 'modifier', 'type', 'variableDeclarators') as Nonterminal | null;
            if (!nodeOfKind) return { type, declarators, modifiers };
            switch (nodeOfKind.kind) {
                case 'modifier':
                    return { type, declarators, modifiers: [...modifiers, this.#build(nodeOfKind)] };
                case 'type':
                    return { type: this.#build(nodeOfKind), declarators, modifiers };
                case 'variableDeclarators': {
                    const declarators = nodeOfKind.parts.filter(isNode('variableDeclarator')).map(part => this.#build(part));

                    return { type, declarators: [...declarators, ...declarators], modifiers };
                }
                default:
                    return { type, declarators, modifiers };
            }
        }, { 
            type: null,
            declarators: [],
            modifiers: []
        } as VariableDeclarationBuildState);
        return this.#buildDefaultNode(tree, {
            modifiers,
            type: type!,
            declarators
        } as VariableDeclarationNode);
    }

    #buildClosure(tree: Nonterminal): ClosureNode {
        const build = this.#build.bind(this);
        const unbracedParts = tree.parts.slice(1, -1);
        const arrowIndex = unbracedParts.findIndex(isTerminalWithToken('ARROW'));
        const parameters = unbracedParts.slice(0, arrowIndex + 1).filter(isNode('formalParameter')).map(build);
        const statements = unbracedParts.slice(arrowIndex + 1).filter(isNonterminal).map(build);

        return this.#buildDefaultNode(tree, {
            parameters,
            statements
        } as ClosureNode);
    }

    #buildPrimary(tree: Nonterminal): SyntaxTreeNode {
        return this.#build(tree.parts[0] as Nonterminal);
    }

    #buildPathExpression(tree: Nonterminal): SyntaxTreeNode {
        const { lastSpan, parts } = tree.parts.slice(1).reduce(({ lastSpan, parts }, part) => {
            if (isToken(part) || isTerminal(part) || part.kind === 'namePart') {
                return { 
                    lastSpan: [...lastSpan, part], 
                    parts 
                };
            };

            const newPart = this.#build(part);
            const newParts = lastSpan.length > 0 
                ? [this.#buildSpan('pathPart', lastSpan), newPart]
                : [newPart];

            return {
                lastSpan: [],
                parts: [...parts, ...newParts]
            };
        }, { lastSpan: [] as SyntaxNode[], parts: [] as SyntaxTreeNode[] });
        if (lastSpan.length > 0) {
            parts.push(this.#buildSpan('pathPart', lastSpan));
        }
        if (parts.length === 0) return this.#build(tree.parts[0]!)

        return this.#buildDefaultNode(tree,  {
            primary: this.#build(tree.parts[0]!),
            parts
        } as PathExpressionNode);
    }

    #buildCommandExpression(tree: Nonterminal): CommandExpressionNode {
        if (tree.parts.length === 1) return this.#build(tree.parts[0]!);
        return this.#buildDefaultNode(tree);
    }

    #buildStatement(tree: Nonterminal): StatementNode {
        const knownStatement = getNodeOfKindLeftPosition(tree, 
            'commandExpression', 
            'localVariableDeclaration', 
            'assignmentExpression'
        ) as Nonterminal | null;
        if (knownStatement) return this.#build(knownStatement);

        return this.#buildDefaultNode(tree);
    }

    #buildImportDeclaration(tree: Nonterminal): ImportDeclarationNode {
        const text = this.#spanProvider.getNodeText(tree.parts.slice(1));
        return this.#buildDefaultNode(tree, {
            name: text,
            spread: text.includes('*'),
        } as ImportDeclarationNode);
    }

    #buildPackageDeclaration(tree: Nonterminal): PackageDeclarationNode {
        return this.#buildDefaultNode(tree, {
            name: this.#spanProvider.getNodeText(tree.parts[1])
        } as PackageDeclarationNode);
    }

    #buildProgram(tree: Nonterminal) : ProgramNode {
        if (tree.kind !== 'main') throw new Error(`Expected root node of kind 'main', but got '${tree.kind}'`);
        let packageDeclarationNode: PackageDeclarationNode | null = null;
        let importDeclarationNodes: ImportDeclarationNode[] = [];
        let statements: StatementNode[] = [];

        for (const part of tree.parts) {
            if (isNonterminal(part)) {
                switch (part.kind) {
                    case 'packageDeclaration':
                        packageDeclarationNode = this.#build(part) as PackageDeclarationNode;
                        break;
                    case 'importDeclaration':
                        importDeclarationNodes.push(this.#build(part) as ImportDeclarationNode);
                        break;
                    default:
                        statements.push(this.#build(part) as StatementNode);
                }
            }
        }

        return {
            packageDeclaration: packageDeclarationNode,
            importDeclarations: importDeclarationNodes,
            statements: statements ?? []
        };
    }

    buildTree(tree: Nonterminal): ProgramNode {
        return this.#buildProgram(tree);
    }
}