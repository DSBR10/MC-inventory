import { CloudWatchClient, GetMetricStatisticsCommand, ListMetricsCommand, Dimension } from '@aws-sdk/client-cloudwatch';
import { MetricData, MetricStatistic } from '@/types/monitoring-aws';

export class CloudWatchMetricsService {
  private client: CloudWatchClient;

  constructor(region: string = process.env.AWS_REGION || 'us-east-1') {
    this.client = new CloudWatchClient({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  /**
   * Obtiene métricas de EC2
   */
  async getEC2Metrics(instanceId: string, period: number = 300): Promise<MetricData[]> {
    const metrics = ['CPUUtilization', 'NetworkIn', 'NetworkOut', 'DiskReadBytes', 'DiskWriteBytes'];
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 3600000); // Última hora

    const metricPromises = metrics.map(metric =>
      this.getMetricStatistics('AWS/EC2', metric, [{ Name: 'InstanceId', Value: instanceId }], startTime, endTime, period)
    );

    return Promise.all(metricPromises);
  }

  /**
   * Obtiene métricas de RDS
   */
  async getRDSMetrics(dbInstanceIdentifier: string, period: number = 300): Promise<MetricData[]> {
    const metrics = [
      'CPUUtilization',
      'DatabaseConnections',
      'FreeableMemory',
      'FreeStorageSpace',
      'ReadLatency',
      'WriteLatency',
      'ReadThroughput',
      'WriteThroughput',
    ];
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 3600000);

    const metricPromises = metrics.map(metric =>
      this.getMetricStatistics('AWS/RDS', metric, [{ Name: 'DBInstanceIdentifier', Value: dbInstanceIdentifier }], startTime, endTime, period)
    );

    return Promise.all(metricPromises);
  }

  /**
   * Obtiene métricas de ECS
   */
  async getECSMetrics(clusterName: string, serviceName: string, period: number = 300): Promise<MetricData[]> {
    const metrics = ['CPUUtilization', 'MemoryUtilization'];
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 3600000);

    const metricPromises = metrics.map(metric =>
      this.getMetricStatistics(
        'AWS/ECS',
        metric,
        [
          { Name: 'ClusterName', Value: clusterName },
          { Name: 'ServiceName', Value: serviceName },
        ],
        startTime,
        endTime,
        period
      )
    );

    return Promise.all(metricPromises);
  }

  /**
   * Obtiene estadísticas de una métrica específica
   */
  private async getMetricStatistics(
    namespace: string,
    metricName: string,
    dimensions: Dimension[],
    startTime: Date,
    endTime: Date,
    period: number
  ): Promise<MetricData> {
    const command = new GetMetricStatisticsCommand({
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: dimensions,
      StartTime: startTime,
      EndTime: endTime,
      Period: period,
      Statistics: ['Average', 'Maximum', 'Minimum'],
    });

    const response = await this.client.send(command);

    const datapoints: MetricStatistic[] = (response.Datapoints || []).map(dp => ({
      timestamp: dp.Timestamp?.toISOString() || new Date().toISOString(),
      average: dp.Average,
      maximum: dp.Maximum,
      minimum: dp.Minimum,
      sum: dp.Sum,
      sampleCount: dp.SampleCount,
    }));

    return {
      metricName,
      namespace,
      dimensions: dimensions.reduce((acc, d) => ({ ...acc, [d.Name || '']: d.Value }), {}),
      statistics: datapoints.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
      unit: response.Datapoints?.[0]?.Unit || 'None',
    };
  }

  /**
   * Lista todas las métricas disponibles para un namespace
   */
  async listMetrics(namespace: string): Promise<string[]> {
    const command = new ListMetricsCommand({ Namespace: namespace });
    const response = await this.client.send(command);
    return [...new Set((response.Metrics || []).map(m => m.MetricName || ''))];
  }
}
