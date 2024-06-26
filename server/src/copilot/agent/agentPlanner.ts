import { getGeneralTemplate } from './promptTemplates/generalTemplate';
import { getConcertoInlineTemplate } from './promptTemplates/concertoInlineTemplate';
import { getInlineTemplate } from './promptTemplates/inlineTemplate';
import { getFixTemplate } from './promptTemplates/fixTemplate';
import { getGrammarTemplate } from './promptTemplates/grammarTemplate';
import { AgentPlannerParams, RequestType, Language, Documents, PromptConfig } from '../utils/types';
import { generateEmbeddingPrompt } from '../utils/embeddingsUtils';
import { generateEmbeddingsByProvider } from '../api/llmModelManager';
import { getConcertoModelTemplate } from './promptTemplates/concertoModelTemplate';

export async function agentPlanner(params: AgentPlannerParams): Promise<Array<{ content: string; role: string }>> {
  const { documents, promptConfig, config } = params;
  const { content } = documents.main;
  const { requestType } = promptConfig;

  let prompt;

  switch (requestType) {
    case RequestType.Inline:
      prompt = inlineRequestPrompt(documents, promptConfig);
      break;
    case RequestType.Fix:
      prompt = getFixTemplate(content, promptConfig);
      break;
    case RequestType.General:
      prompt = getGeneralTemplate(promptConfig);
      break;
    case RequestType.Model:
      prompt = await modelRequestPrompt(documents, config);
      break;  
    case RequestType.Grammar:
      prompt = await getGrammarTemplate(documents);
      break;  
    default:
      throw new Error('Unsupported request type');
  }

  return prompt;
}

function inlineRequestPrompt(documents: any, promptConfig: any) {
  let { content, cursorPosition } = documents.main;
  const { language } = promptConfig;

  if (!cursorPosition) {
    cursorPosition = content.length;
  }

  const beforeCursor = content.slice(0, cursorPosition);
  const afterCursor = content.slice(cursorPosition);
  return language === Language.Concerto
    ? getConcertoInlineTemplate(beforeCursor, afterCursor, promptConfig)
    : getInlineTemplate(beforeCursor, afterCursor, promptConfig);
}

async function modelRequestPrompt(documents: any, config: any) {
  const { provider } = config;

  const embeddingPrompt = generateEmbeddingPrompt(documents);
  const promptEmbedding = await generateEmbeddingsByProvider(provider, config, embeddingPrompt);
  return getConcertoModelTemplate(documents, promptEmbedding, provider);
}


