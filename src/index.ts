import {
  initInstrumentation,
  createSpan,
} from '@metronetinc/node-express-opentelemetry-package/src/index';
import express, { Express, Request, Response } from 'express';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import api from '@opentelemetry/api';
import httpContext from 'express-http-context';

const zipkinSpanExporter = new ZipkinExporter({
  url: 'http://localhost:9411/api/v2/spans',
  serviceName: process.env.npm_package_name,
});

initInstrumentation(undefined, zipkinSpanExporter);

const PORT: number = parseInt(process.env.PORT || '8080');
const app: Express = express();

const tracer = api.trace.getTracer(process.env.npm_package_name as string);

// function traceMiddleware(req: Request, _res: Response, next: any) {
//   const span = tracer.startSpan(req.path);
//   api.context.with(api.trace.setSpan(api.context.active(), span), () => {
//     span.addEvent('request received');
//     next();
//   });
// }

function traceMiddleware(req: any, res: any, next: any) {
  const span = tracer.startSpan(req.path);
  //   api.context.with(api.trace.setSpan(api.context.active(), span), () => {
  //     span.addEvent('request received');
  //     next();
  //   });
  const { headers } = req;
  const spanOptions: any = {};
  const spanContext = api.propagation.extract(api.context.active(), headers);
  if (spanContext) {
    spanOptions.parent = spanContext;
  }

  const requestSpan = tracer.startSpan(`${req.method} ${req.url}`, spanOptions);

  requestSpan.setAttribute('http.method', req.method);
  requestSpan.setAttribute('http.user_agent', req.get('User-Agent'));

  const previousRequestSpan = httpContext.get('REQUEST_SPAN') || [];

  httpContext.set('REQUEST_SPAN', [...previousRequestSpan, requestSpan]);
  res.once('finish', () => {
    requestSpan.setAttribute('http.status_code', res.statusCode);
    requestSpan.end();
  });

  next();
}

app.use(traceMiddleware);

app.get('/another', (_req: Request, res: Response) => {
  const span = createSpan('another-span');
  span.addEvent('response sent');
  console.log('another');
  span.end();
  res.send([{ name: 'prod1', price: 9 }]);
});

app.listen(PORT, () => {
  console.log(`Listening for requests on http://localhost:${PORT}`);
});
