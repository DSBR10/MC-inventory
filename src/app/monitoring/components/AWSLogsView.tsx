'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CloudWatchLog, CloudTrailEvent, LogGroup } from '@/types/monitoring-aws';
import { Loader2, FileText, Shield, Search } from 'lucide-react';

export default function AWSLogsView() {
  const [activeTab, setActiveTab] = useState<'cloudwatch' | 'cloudtrail'>('cloudwatch');
  
  // CloudWatch state
  const [logGroups, setLogGroups] = useState<LogGroup[]>([]);
  const [selectedLogGroup, setSelectedLogGroup] = useState('');
  const [cloudWatchLogs, setCloudWatchLogs] = useState<CloudWatchLog[]>([]);
  const [filterPattern, setFilterPattern] = useState('');
  
  // CloudTrail state
  const [cloudTrailEvents, setCloudTrailEvents] = useState<CloudTrailEvent[]>([]);
  const [username, setUsername] = useState('');
  const [eventName, setEventName] = useState('');
  
  // Common state
  const [region, setRegion] = useState('us-east-1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (activeTab === 'cloudwatch') {
      fetchLogGroups();
    }
  }, [region, activeTab]);

  const fetchLogGroups = async () => {
    try {
      const response = await fetch(`/api/monitoring/aws/cloudwatch-logs?region=${region}`);
      const data = await response.json();
      if (response.ok) {
        setLogGroups(data.logGroups);
      }
    } catch (err) {
      console.error('Error fetching log groups:', err);
    }
  };

  const fetchCloudWatchLogs = async () => {
    if (!selectedLogGroup) {
      setError('Por favor selecciona un Log Group');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let url = `/api/monitoring/aws/cloudwatch-logs?logGroupName=${selectedLogGroup}&region=${region}`;
      
      if (startTime) url += `&startTime=${new Date(startTime).toISOString()}`;
      if (endTime) url += `&endTime=${new Date(endTime).toISOString()}`;
      if (filterPattern) url += `&filterPattern=${encodeURIComponent(filterPattern)}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener logs');
      }

      setCloudWatchLogs(data.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const fetchCloudTrailEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      let url = `/api/monitoring/aws/cloudtrail?region=${region}`;
      
      if (startTime) url += `&startTime=${new Date(startTime).toISOString()}`;
      if (endTime) url += `&endTime=${new Date(endTime).toISOString()}`;
      if (username) url += `&username=${encodeURIComponent(username)}`;
      if (eventName) url += `&eventName=${encodeURIComponent(eventName)}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener eventos');
      }

      setCloudTrailEvents(data.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Logs de AWS</CardTitle>
          <CardDescription>
            Visualiza logs de CloudWatch y eventos de CloudTrail
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="cloudwatch" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                CloudWatch Logs
              </TabsTrigger>
              <TabsTrigger value="cloudtrail" className="flex items-center gap-2">
         <Shield className="h-4 w-4" />
             CloudTrail
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cloudwatch" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Región</label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                  <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                      <SelectItem value="us-east-2">US East (Ohio)</SelectItem>
                      <SelectItem value="us-west-1">US West (N. California)</SelectItem>
                      <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Log Group</label>
                  <Select value={selectedLogGroup} onValueChange={setSelectedLogGroup}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un log group" />
                    </SelectTrigger>
                    <SelectContent>
                  {logGroups.map((lg) => (
                        <SelectItem key={lg.logGroupName} value={lg.logGroupName}>
                          {lg.logGroupName}
                  </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Fecha Inicio</label>
                  <Input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Fecha Fin</label>
                  <Input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium mb-2 block">Patrón de Filtro</label>
                  <Input
                    placeholder='Ej: [ERROR]'
                    value={filterPattern}
                    onChange={(e) => setFilterPattern(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={fetchCloudWatchLogs} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
             <Search className="mr-2 h-4 w-4" />
                Buscar Logs
              </Button>
            </TabsContent>

         <TabsContent value="cloudtrail" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Región</label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger>
                   <SelectValue />
                  </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                      <SelectItem value="us-east-2">US East (Ohio)</SelectItem>
                      <SelectItem value="us-west-1">US West (N. California)</SelectItem>
                      <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                 </SelectContent>
                  </Select>
           </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Usuario</label>
                  <Input
                    placeholder="nombre-usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                <div>
            <label className="text-sm font-medium mb-2 block">Nombre del Evento</label>
                  <Input
                    placeholder="Ej: CreateBucket"
               value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Fecha Inicio</label>
                  <Input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
            </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Fecha Fin</label>
                  <Input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                />
                </div>
              </div>

              <Button onClick={fetchCloudTrailEvents} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Search className="mr-2 h-4 w-4" />
                Buscar Eventos
              </Button>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
              {error}
            </div>
          )}
        </CardContent>
      </Card>


      {/* CloudWatch Logs Results */}
      {activeTab === 'cloudwatch' && cloudWatchLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados de CloudWatch Logs</CardTitle>
            <CardDescription>{cloudWatchLogs.length} logs encontrados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {cloudWatchLogs.map((log, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-md border border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs text-gray-500">{log.logStreamName}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <pre className="text-sm whitespace-pre-wrap break-words font-mono">
                    {log.message}
                  </pre>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CloudTrail Events Results */}
      {activeTab === 'cloudtrail' && cloudTrailEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Eventos de CloudTrail</CardTitle>
            <CardDescription>{cloudTrailEvents.length} eventos encontrados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {cloudTrailEvents.map((event, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-md border border-gray-200">
                  <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                      <span className="text-xs font-medium text-gray-500">Evento:</span>
                      <p className="text-sm font-semibold">{event.eventName}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500">Usuario:</span>
                      <p className="text-sm">{event.username}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500">Fecha/Hora:</span>
                      <p className="text-sm">{new Date(event.eventTime).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500">Fuente:</span>
                      <p className="text-sm">{event.eventSource || 'N/A'}</p>
                    </div>
                  </div>
                  
                  {event.resources && event.resources.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs font-medium text-gray-500">Recursos:</span>
                      <div className="mt-1 space-y-1">
                        {event.resources.map((resource, idx) => (
                          <div key={idx} className="text-sm bg-white p-2 rounded border">
                            <span className="font-medium">{resource.resourceType}:</span> {resource.resourceName}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
