import { getLeftmostToken, getRightmostToken, Nonterminal, isNonterminal } from "./ast";
import { AstSpanProvider } from "./span";

interface TreeNode {
    offset: number;
    length: number;
    text: string;
}

type PackageDeclarationNode = TreeNode & {
    name: string;
}

type ImportDeclarationNode = TreeNode & {
    name: string;
    spread: boolean;
}

type StatementNode = TreeNode & {
    kind: string;
}

type ProgramNode = {
    packageDeclaration: PackageDeclarationNode | null;
    importDeclarations: ImportDeclarationNode[];
    statements: StatementNode[];
}
export class TreeBuilder {
    readonly #spanProvider: AstSpanProvider;
    constructor(spanProvider: AstSpanProvider) {
        this.#spanProvider = spanProvider;
    }

    #buildStatement(tree: Nonterminal): StatementNode {
        return tree as unknown as StatementNode;
    }

    #buildImportDeclaration(tree: Nonterminal): ImportDeclarationNode {
        return tree as unknown as ImportDeclarationNode;
    }

    #buildPackageDeclaration(tree?: Nonterminal): PackageDeclarationNode | null {
        if (!tree) return null;
        const letmostToken = getLeftmostToken(tree);
        const rightmostToken = getRightmostToken(tree);

        if (!letmostToken || !rightmostToken) return null;
        return {
            name: this.#spanProvider.getNodeText(tree.parts[1]),
            text: this.#spanProvider.getNodeText(tree),
            offset: tree.offset,
            length: tree.length
        }
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
                        packageDeclarationNode = this.#buildPackageDeclaration(part);
                        break;
                    case 'importDeclaration':
                        importDeclarationNodes.push(this.#buildImportDeclaration(part));
                        break;
                    case 'statement':
                        statements.push(this.#buildStatement(part));
                        break;
                    case 'typeDeclaration':
                        statements.push(this.#buildStatement(part));
                        break;
                    default:
                        statements.push(this.#buildStatement(part));
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