import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  GetCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, Handler } from "aws-lambda";
import { z } from "zod";
import { v4 as uuid } from "uuid";

const recipeSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  source: z.string().optional(),
  sourceUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  ovenTemp: z.string().optional(),
  cookTime: z.string().optional(),
  ingredients: z.string().array().optional(),
  steps: z.string().array().optional(),
  tags: z.string().array().optional(),
  authorNotes: z.string().optional(),
  notes: z.string().optional(),
});

const newRecipeSchema = recipeSchema
  .omit({ id: true })
  .required({ title: true });

const client = new DynamoDBClient({});

const dynamo = DynamoDBDocumentClient.from(client);

const tableName = "recipes";

export const handler: Handler = async (event: APIGatewayProxyEvent) => {
  let body;
  let statusCode = 200;
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "http://recipe-first-test.s3-website.us-east-2.amazonaws.com" };

  console.log(JSON.stringify(event, null, 2));

  try {
    switch (event.resource) {
      case "/recipes/{id}":
        if (event.pathParameters == null || !event.pathParameters["id"])
          throw new Error();
        if (event.httpMethod === 'DELETE') {
          await dynamo.send(
            new DeleteCommand({
              TableName: tableName,
              Key: { id: event.pathParameters["id"] },
            })
          );
          body = `Deleted item ${event.pathParameters["id"]}`;
          break;
        }
        if (event.httpMethod === 'GET') {
          body = await dynamo.send(
            new GetCommand({
              TableName: tableName,
              Key: {
                id: event.pathParameters.id,
              },
            })
          );
          body = body.Item;
          break;
        }
        throw new Error(`invalid method '${event.httpMethod}'`);
      case "/recipes":
        body = await dynamo.send(new ScanCommand({ TableName: tableName }));
        body = body.Items;
        break;
      case "/recipes/new":
        if (event.body == null) throw new Error();
        const newRecipeParseResults = newRecipeSchema.safeParse(JSON.parse(event.body));
        if (newRecipeParseResults.success === false) {
          throw new Error(newRecipeParseResults.error.message);
        }
        const item = { id: uuid(), ...newRecipeParseResults.data };
        await dynamo.send(
          new PutCommand({
            TableName: tableName,
            Item: item,
          })
        );
        body = `Put item ${item.id}`;
        break;
      case "/recipes/update":
        if (event.body == null) throw new Error();
        const parseResults = recipeSchema.safeParse(JSON.parse(event.body));
        if (parseResults.success === false) {
          throw new Error(parseResults.error.message);
        }
        await dynamo.send(
          new PutCommand({
            TableName: tableName,
            Item: parseResults.data,
          })
        );
        body = `Update item ${parseResults.data.id}`;
        break;
      default:
        throw new Error(`Unsupported route: "${event.path}"`);
    }
  } catch (err) {
    let message = "unknown error";
    if (err instanceof Error) message = err.message;
    statusCode = 400;
    body = message;
  } finally {
    body = JSON.stringify(body);
  }

  return {
    statusCode,
    headers,
    body,
  };
};
