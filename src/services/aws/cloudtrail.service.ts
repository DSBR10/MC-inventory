import {
  CloudTrailClient,
  LookupEventsCommand,
  LookupAttribute,
} from "@aws-sdk/client-cloudtrail";
import { CloudTrailEvent } from "@/types/monitoring-aws";

export class CloudTrailService {
  private client: CloudTrailClient;

  constructor(
    region: string = process.env.AWS_REGION || "us-east-1",
    credentials?: {
      accessKeyId: string;
      secretAccessKey: string;
    },
  ) {
    this.client = new CloudTrailClient({
      region,
      credentials: credentials || {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }

  /**
   * Obtiene eventos de CloudTrail
   */
  async getEvents(
    startTime?: Date,
    endTime?: Date,
    username?: string,
    resourceType?: string,
    eventName?: string,
    maxResults: number = 50,
  ): Promise<CloudTrailEvent[]> {
    const lookupAttributes: LookupAttribute[] = [];

    if (username) {
      lookupAttributes.push({
        AttributeKey: "Username",
        AttributeValue: username,
      });
    }
    if (resourceType) {
      lookupAttributes.push({
        AttributeKey: "ResourceType",
        AttributeValue: resourceType,
      });
    }
    if (eventName) {
      lookupAttributes.push({
        AttributeKey: "EventName",
        AttributeValue: eventName,
      });
    }

    const command = new LookupEventsCommand({
      StartTime: startTime,
      EndTime: endTime,
      LookupAttributes:
        lookupAttributes.length > 0 ? lookupAttributes : undefined,
      MaxResults: maxResults,
    });

    const response = await this.client.send(command);

    return (response.Events || []).map((event) => ({
      eventId: event.EventId || "",
      eventName: event.EventName || "",
      eventTime: event.EventTime?.toISOString() || new Date().toISOString(),
      username: event.Username || "",
      resources: (event.Resources || []).map((r) => ({
        resourceType: r.ResourceType || "",
        resourceName: r.ResourceName || "",
      })),
      cloudTrailEvent: event.CloudTrailEvent || "",
      eventSource: event.EventSource,
      accessKeyId: event.AccessKeyId,
    }));
  }

  /**
   * Obtiene eventos de un usuario específico
   */
  async getEventsByUser(
    username: string,
    startTime?: Date,
    endTime?: Date,
  ): Promise<CloudTrailEvent[]> {
    return this.getEvents(startTime, endTime, username);
  }

  /**
   * Obtiene eventos de un tipo de recurso específico
   */
  async getEventsByResourceType(
    resourceType: string,
    startTime?: Date,
    endTime?: Date,
  ): Promise<CloudTrailEvent[]> {
    return this.getEvents(startTime, endTime, undefined, resourceType);
  }

  /**
   * Obtiene eventos de un tipo de evento específico
   */
  async getEventsByEventName(
    eventName: string,
    startTime?: Date,
    endTime?: Date,
  ): Promise<CloudTrailEvent[]> {
    return this.getEvents(startTime, endTime, undefined, undefined, eventName);
  }
}
