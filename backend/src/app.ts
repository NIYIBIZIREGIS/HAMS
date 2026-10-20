import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/env';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { RawBodyRequest } from './types/request';
import { swaggerSpec } from './config/swagger';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import facilityRoutes from './routes/facilityRoutes';
import userRoutes from './routes/userRoutes';
import departmentRoutes from './routes/departmentRoutes';
import doctorRoutes from './routes/doctorRoutes';
import patientRoutes from './routes/patientRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import medicalRecordRoutes from './routes/medicalRecordRoutes';
import prescriptionRoutes from './routes/prescriptionRoutes';
import labTestRoutes from './routes/labTestRoutes';
import pharmacyRoutes from './routes/pharmacyRoutes';
import paymentRoutes from './routes/paymentRoutes';
import claimRoutes from './routes/claimRoutes';
import insuranceProviderRoutes from './routes/insuranceProviderRoutes';
import messageRoutes from './routes/messageRoutes';
import notificationRoutes from './routes/notificationRoutes';
import patientDocumentRoutes from './routes/patientDocumentRoutes';
import auditLogRoutes from './routes/auditLogRoutes';

export const app = express();

app.use(helmet());

// Behind a reverse proxy or load balancer, `req.ip` is the proxy's address unless Express is
// told to trust the forwarding headers. That value is written to every audit entry, so getting
// this wrong silently attributes every action in the trail to the proxy instead of the client
// that performed it.
app.set('trust proxy', config.trustProxy);
app.use(
  cors({
    origin: config.corsOrigin.split(','),
    credentials: true,
  })
);
// The raw body is retained for request signing. An HMAC is computed over the exact bytes the
// gateway sent, and re-serialising a parsed object is not guaranteed to reproduce them — key
// order and whitespace both change the digest, so verifying against `req.body` would reject
// legitimate traffic. The buffer is capped by the same 2mb limit.
app.use(
  express.json({
    limit: '2mb',
    verify: (req, _res, buf) => {
      (req as RawBodyRequest).rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests' },
  })
);

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'HAS API is healthy', timestamp: new Date().toISOString() });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/medical-records', medicalRecordRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/lab-tests', labTestRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/insurance-providers', insuranceProviderRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/patient-documents', patientDocumentRoutes);
app.use('/api/audit-logs', auditLogRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
