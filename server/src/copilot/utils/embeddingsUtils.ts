import * as math from 'mathjs';
import { Documents, ModelEmbeddings, ModelsEmbeddingsData, TemplateEmbeddings } from './types';
import { log } from 'console';

function cosineSimilarity(vec1: number[], vec2: number[]): number {
    const dotProduct = math.dot(vec1, vec2);
    const normVec1:any = math.norm(vec1);
    const normVec2:any = math.norm(vec2);
    return dotProduct / (normVec1 * normVec2);
}

export function fetchRelevantNamespaces(modelNamespaces: { [key: string]: ModelEmbeddings }, promptEmbedding: number[], provider: string, topN = 4): string[] {
    log('Fetching relevant namespaces' + promptEmbedding );
    const namespaceSimilarities: [number, string, string][] = [];

    for (const [file, obj] of Object.entries(modelNamespaces)) {
        let embeddings: number[] | undefined; 

        if (provider === 'gemini' && obj.gemini?.embeddings?.embedding) {
            embeddings = obj.gemini.embeddings.embedding;
        } else if (provider === 'openai' && obj.openai?.embeddings) {
            embeddings = obj.openai.embeddings;
        }

        if (embeddings && Array.isArray(embeddings)) {
            const similarity = cosineSimilarity(promptEmbedding, embeddings);
            namespaceSimilarities.push([similarity, file, obj.fileContent]);
        }
    }

    const topNamespaces = namespaceSimilarities.sort((a, b) => b[0] - a[0]).slice(0, topN);

    const relevantNamespaces = topNamespaces.map(([similarity, file, fileContent]) => {
        return `${file}\n`;
    });

    return relevantNamespaces;
}

export function fetchRelevantTemplates(templateEmbeddings: TemplateEmbeddings, promptEmbedding: number[], provider: string, topN = 4): string[] {
    log('Fetching relevant templates' + promptEmbedding);
    const templateSimilarities: [number, string, string, string][] = [];

    for (const [templateName, template] of Object.entries(templateEmbeddings)) {
        let embeddings: number[] | undefined;

        if (provider === 'gemini' && template.grammar?.embeddings?.gemini?.embedding) {
            embeddings = template.grammar.embeddings.gemini.embedding;
        } else if (provider === 'openai' && template.grammar?.embeddings?.openai) {
            embeddings = template.grammar.embeddings.openai;
        }

        if (embeddings && Array.isArray(embeddings)) {
            const similarity = cosineSimilarity(promptEmbedding, embeddings);
            // Clean the model content to remove all import statements
            const cleanedModelContent = template.grammar?.content.replace(/import .*\n/g, '');
            templateSimilarities.push([similarity, templateName, template.grammar?.content, cleanedModelContent]);
        }
    }

    // Sort the templates by similarity in descending order
    const topTemplates = templateSimilarities.sort((a, b) => b[0] - a[0]).slice(0, topN);

    // Generate the relevant templates output
    const relevantTemplates = topTemplates.map(([similarity, templateName, grammarContent, modelContent]) => {
        return `Template: ${templateName}\nTemplate grammar: ${grammarContent}\nCorresponding model: ${modelContent}\n`;
    });

    return relevantTemplates;
}

export function fetchRelevantGrammar(templateEmbeddings: TemplateEmbeddings, promptEmbedding: number[], provider: string, topN = 3): string[] {
    log('Fetching relevant grammar templates' + promptEmbedding);
    const templateSimilarities: [number, string, string, string][] = [];

    for (const [templateName, template] of Object.entries(templateEmbeddings)) {
        let embeddings: number[] | undefined; 

        if (provider === 'gemini' && template.grammar?.embeddings?.gemini?.embedding) {
            embeddings = template.grammar.embeddings.gemini.embedding;
        } else if (provider === 'openai' && template.grammar?.embeddings?.openai) {
            embeddings = template.grammar.embeddings.openai;
        }

        if (embeddings && Array.isArray(embeddings)) {
            const similarity = cosineSimilarity(promptEmbedding, embeddings);
            templateSimilarities.push([similarity, templateName, template.sample?.content, template.grammar?.content]);
        }
    }
      

    const topTemplates = templateSimilarities.sort((a, b) => b[0] - a[0]).slice(0, topN);

    const relevantTemplates = topTemplates.map(([similarity, file, sampleContent ,grammarContent]) => {
        return `Template sample: ${sampleContent}\n and corresponding grammar: ${grammarContent}\n`;
    });

    return relevantTemplates;
}

export function generateEmbeddingPrompt(documents: Documents, requestType: string): string {
	const { contextDocuments } = documents;
  
    let prompt = '';
    if (requestType === 'grammar') {
        const sampleContent = contextDocuments?.find(doc => doc.fileName === 'sample.md')?.content;
        prompt = `${sampleContent}`;
    }
    else if (requestType === 'model') {
        const grammarContent = contextDocuments?.find(doc => doc.fileName === 'grammar.tem.md')?.content;
        const packageContent = contextDocuments?.find(doc => doc.fileName === 'package.json')?.content;
    
        if (!grammarContent || !packageContent) {
        throw new Error("Required documents are missing");
        }
        
        prompt = `${grammarContent} ${packageContent}`;
    }

	return prompt;
}

function extractNamespaces(fileContent: string): string[] {
    const namespaceRegex = /\b(?:asset|participant|enum|abstract asset)\s+(\w+)/g;
    let match;
    const namespaces: string[] = [];
    
    while ((match = namespaceRegex.exec(fileContent)) !== null) {
        namespaces.push(match[1]);
    }

    return namespaces;
}

export function getNamespaceMappings(modelEmbeddings: ModelsEmbeddingsData): string {
    const namespaceMappings: { [key: string]: string[] } = {};

    Object.keys(modelEmbeddings).forEach(key => {
        const fileContent = modelEmbeddings[key].fileContent;
        const fileName = modelEmbeddings[key].fileName;
        const namespaces = extractNamespaces(fileContent);
        namespaceMappings[fileName] = namespaces;
    });

    let result = generateCTOImports(namespaceMappings);

    return result;
}

function generateCTOImports(namespaceMappings: { [key: string]: string[] }): string {
    let result = '';

    for (const [key, values] of Object.entries(namespaceMappings)) {
        if (values.length === 1) {
            result += `import org.accordproject.${key.replace(".cto", "")}.${values[0]} from https://models.accordproject.org/accordproject/${key}\n`;
        } else if (values.length > 1) {
            result += `import org.accordproject.${key.replace(".cto", "")}.{ ${values.join(', ')} } from https://models.accordproject.org/accordproject/${key}\n`;
        }
    }

    return result;
}
