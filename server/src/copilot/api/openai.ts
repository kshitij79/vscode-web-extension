import axios from 'axios';
import { log } from '../../state';
import { LLM_ENDPOINTS, LLM_EMDEDDINGS_ENDPOINTS } from '../utils/constants';
import { ModelConfig, Embedding } from '../utils/types';

/*
	API call to generate content using the OpenAI model
	Documentation: https://platform.openai.com/docs/api-reference/completions/create
	Sample Endpoint: https://api.openai.com/v1/completions
	based on the API documentation, these interfaces are used to generate content using the OpenAI models
*/

interface Message {
    role: string;
    content: string;
}

interface GenerateContentRequest {
    model: string;
    messages: Message[];
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
}

interface GenerateEmbeddingsRequest {
    input: string[];
    model: string;
}

function createGenerateContentRequest(promptArray: Message[], config: ModelConfig): GenerateContentRequest {
    const { llmModel, additionalParams } = config;

    const request: GenerateContentRequest = {
        model: llmModel,
        messages: promptArray,
    };

    if (additionalParams?.temperature !== undefined) request.temperature = additionalParams.temperature;
    if (additionalParams?.maxTokens !== undefined) request.max_tokens = additionalParams.maxTokens;
    if (additionalParams?.topP !== undefined) request.top_p = additionalParams.topP;
    if (additionalParams?.frequencyPenalty !== undefined) request.frequency_penalty = additionalParams.frequencyPenalty;
    if (additionalParams?.presencePenalty !== undefined) request.presence_penalty = additionalParams.presencePenalty;
    
    return request;
}

function createGenerateEmbeddingsRequest(text: string, model: string): GenerateEmbeddingsRequest {
    return {
        input: [text],
        model: model,
    };
}

// API call to generate content using the OpenAI model
export async function generateContent(config: ModelConfig, promptArray: Message[]): Promise<string> {
    let { apiUrl, accessToken } = config;

    if (!apiUrl) 
        apiUrl = LLM_ENDPOINTS.OPENAI;

    const request: GenerateContentRequest = createGenerateContentRequest(promptArray, config);

    try {
        const response = await axios.post<any>(
            apiUrl,
            request,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        if (response.status === 200 && response.data.choices && response.data.choices.length > 0) {
            let generatedContent = response.data;
            let text = generatedContent?.choices[0]?.message?.content;
            return text;
        } else {
            log('Error: Invalid status code or no choices returned' + response.status + response.data);
            throw new Error('Failed to generate content. Invalid response from server.');
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.response) {
                log('Error generating content: ' + error.response.status + ' ' + error.response.statusText);
                log('Response data:' + JSON.stringify(error.response.data));
                throw new Error(`Failed to generate content due to an error (${error.response.status} ${error.response.statusText}).`);
            } else if (error.request) {
                log('Error generating content: Request failed' + ', Request data: ' + error.config);
                throw new Error('Failed to send request to the server.');
            } else {
                log('Error generating content: ' + error.message);
                throw new Error('An error occurred while processing the request.');
            }
        } else {
            log('Error generating content: ' + error);
            throw new Error('An unexpected error occurred while generating content.');
        }
    }
}

// API call to generate embeddings using the OpenAI model
export async function generateEmbeddings(config: ModelConfig, text: string): Promise<Embedding[]> {
    let { apiUrl, accessToken, embeddingModel } = config;

    if (!apiUrl) 
        apiUrl = LLM_EMDEDDINGS_ENDPOINTS.OPENAI;
    
    let updatedApiUrl: string = apiUrl?.includes('openai') ? apiUrl : apiUrl + '/embeddings';
    
    embeddingModel = embeddingModel || 'text-embedding-ada-002';
    const request: GenerateEmbeddingsRequest = createGenerateEmbeddingsRequest(text, embeddingModel);

    try {
        const response = await axios.post<any>(
            updatedApiUrl,
            request,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        if (response.status === 200 && response.data.data) {
            const embeddings: Embedding[] = response.data.data[0].embedding;
            return embeddings;
        } else {
            log('Error: Invalid status code or no embedding returned');
            log('Response Status: ' + response.status + ', Response Data: ' + response.data);
            throw new Error('Failed to generate embeddings');
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.response) {
                log('Error generating embeddings: ' + error.response.status + ' ' + error.response.statusText);
                log('Response data: ' + JSON.stringify(error.response.data));
                throw new Error(`Failed to generate embeddings due to an error (${error.response.status} ${error.response.statusText}).`);
            } else if (error.request) {
                log('Error generating embeddings: Request failed' + ', Request data: ' + error.config);
                throw new Error('Failed to send request to the server.');
            } else {
                log('Error generating embeddings: ' + error.message);
                throw new Error('An error occurred while processing the request.');
            }
        } else {
            log('Error generating embeddings: ' + error);
            throw new Error('An unexpected error occurred while generating embeddings.');
        }
    }
}
