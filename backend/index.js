const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

// Configuracao base da aplicacao
const prisma = new PrismaClient();
const app = express();
const PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const ROLES = {
  ADMIN: 'ADMIN',
  STAFF: 'STAFF'
};
const EVENT_STATUS = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  CLOSED: 'CLOSED'
};
const PARTICIPANT_CATEGORY = {
  ESTUDANTE: 'ESTUDANTE',
  EXPOSITOR: 'EXPOSITOR',
  STAFF: 'STAFF',
  PUBLICO_GERAL: 'PUBLICO_GERAL'
};

app.use(cors());
app.use(express.json());

// Erro HTTP customizado para respostas controladas (400, 404, etc.)
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Helpers de validacao
function isValidIsoDate(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }

  const date = new Date(`${dateStr}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(dateStr);
}

function parsePositiveInt(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    return null;
  }
  return number;
}

function parseOptionalPositiveInt(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = parsePositiveInt(value);
  if (!parsed) {
    throw new HttpError(400, `Campo "${fieldName}" invalido.`);
  }

  return parsed;
}

function requireString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `Campo "${fieldName}" e obrigatorio.`);
  }
  return value.trim();
}

function requireEmail(value) {
  const email = requireString(value, 'email').toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new HttpError(400, 'Email invalido.');
  }
  return email;
}

function requireBoolean(value, fieldName) {
  if (typeof value !== 'boolean') {
    throw new HttpError(400, `Campo "${fieldName}" deve ser boolean.`);
  }
  return value;
}

function normalizeCpf(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\D/g, '');
}

function requireCpf(value) {
  const rawCpf = requireString(value, 'cpf');
  const cpf = normalizeCpf(rawCpf);
  if (!/^\d{11}$/.test(cpf)) {
    throw new HttpError(400, 'CPF invalido. Informe 11 digitos.');
  }
  return cpf;
}

function parseOptionalText(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return requireString(value, fieldName);
}

function parseOptionalTime(value, fieldName) {
  const time = parseOptionalText(value, fieldName);
  if (time === null) {
    return null;
  }

  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new HttpError(400, `Campo "${fieldName}" deve estar no formato HH:MM.`);
  }

  return time;
}

function parseOptionalUf(value) {
  const uf = parseOptionalText(value, 'uf');
  if (uf === null) {
    return null;
  }

  const normalized = uf.toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new HttpError(400, 'Campo "uf" invalido. Use 2 letras, ex: CE.');
  }

  return normalized;
}

function normalizeCategoryInput(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function parseParticipantCategory(value, defaultCategory = PARTICIPANT_CATEGORY.PUBLICO_GERAL) {
  if (value === undefined || value === null || value === '') {
    return defaultCategory;
  }

  const raw = requireString(value, 'categoria');
  const normalized = normalizeCategoryInput(raw);
  const allowed = Object.values(PARTICIPANT_CATEGORY);

  if (!allowed.includes(normalized)) {
    throw new HttpError(400, 'Campo "categoria" invalido. Use: estudante, expositor, staff ou publico geral.');
  }

  return normalized;
}

function parseOptionalEventStatus(value) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new HttpError(400, 'Campo "status" invalido.');
  }

  const normalized = value.toUpperCase();
  const allowed = Object.values(EVENT_STATUS);
  if (!allowed.includes(normalized)) {
    throw new HttpError(400, `Campo "status" deve ser um de: ${allowed.join(', ')}.`);
  }

  return normalized;
}

function csvCell(value) {
  if (value === null || value === undefined) {
    return '""';
  }
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

// Middleware de autenticacao com JWT
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HttpError(401, 'Token nao enviado. Use Authorization: Bearer <token>.');
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email
    };
    next();
  } catch (error) {
    throw new HttpError(401, 'Token invalido ou expirado.');
  }
}

// Middleware de autorizacao por perfil
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      throw new HttpError(401, 'Usuario nao autenticado.');
    }

    if (!roles.includes(req.user.role)) {
      throw new HttpError(403, 'Sem permissao para esta operacao.');
    }

    next();
  };
}

// Healthcheck simples para confirmar backend no ar
app.get('/', (req, res) => {
  res.send('API de credenciamento rodando. Frontend: http://localhost:3000 | Backend: http://localhost:3001');
});

// Cria o primeiro administrador do sistema (somente se ainda nao existir usuario)
app.post('/auth/bootstrap-admin', async (req, res) => {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    throw new HttpError(409, 'Bootstrap bloqueado: ja existe usuario cadastrado.');
  }

  const name = requireString(req.body.name, 'name');
  const email = requireEmail(req.body.email);
  const password = requireString(req.body.password, 'password');

  if (password.length < 6) {
    throw new HttpError(400, 'A senha deve ter no minimo 6 caracteres.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: ROLES.ADMIN
    }
  });

  const token = signToken(admin);
  res.status(201).json({ user: sanitizeUser(admin), token });
});

// Login para ADMIN/STAFF
app.post('/auth/login', async (req, res) => {
  const email = requireEmail(req.body.email);
  const password = requireString(req.body.password, 'password');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new HttpError(401, 'Credenciais invalidas.');
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    throw new HttpError(401, 'Credenciais invalidas.');
  }

  const token = signToken(user);
  res.status(200).json({ user: sanitizeUser(user), token });
});

// Retorna dados do usuario autenticado
app.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    throw new HttpError(404, 'Usuario nao encontrado.');
  }

  res.status(200).json(sanitizeUser(user));
});

// ADMIN: cria usuario STAFF para operacao de credenciamento
app.post('/admin/users/staff', authenticate, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  const name = requireString(req.body.name, 'name');
  const email = requireEmail(req.body.email);
  const password = requireString(req.body.password, 'password');

  if (password.length < 6) {
    throw new HttpError(400, 'A senha deve ter no minimo 6 caracteres.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const staff = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: ROLES.STAFF
    }
  });

  res.status(201).json(sanitizeUser(staff));
});

// ADMIN: cria evento
app.post('/admin/events', authenticate, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  const title = requireString(req.body.title, 'title');
  const description = parseOptionalText(req.body.description, 'description');
  const organizer = parseOptionalText(req.body.organizer, 'organizer');
  const participantLimit = parseOptionalPositiveInt(req.body.participantLimit, 'participantLimit');
  const date = requireString(req.body.date, 'date');
  const eventStart = parseOptionalTime(req.body.eventStart, 'eventStart');
  const eventEnd = parseOptionalTime(req.body.eventEnd, 'eventEnd');
  const location = req.body.location ? requireString(req.body.location, 'location') : null;
  const status = parseOptionalEventStatus(req.body.status) || EVENT_STATUS.DRAFT;

  if (!isValidIsoDate(date)) {
    throw new HttpError(400, 'Campo "date" deve estar no formato YYYY-MM-DD.');
  }

  const event = await prisma.event.create({
    data: { title, description, organizer, participantLimit, date, eventStart, eventEnd, location, status }
  });

  res.status(201).json(event);
});

// ADMIN/STAFF: lista eventos
app.get('/events', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  const events = await prisma.event.findMany({ orderBy: { id: 'desc' } });
  res.status(200).json(events);
});

// ADMIN/STAFF: detalhe de evento
app.get('/events/:id', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  const eventId = parsePositiveInt(req.params.id);
  if (!eventId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new HttpError(404, 'Evento nao encontrado.');
  }

  res.status(200).json(event);
});

// ADMIN: atualiza evento
app.put('/admin/events/:id', authenticate, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  const eventId = parsePositiveInt(req.params.id);
  if (!eventId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  const title = requireString(req.body.title, 'title');
  const description = parseOptionalText(req.body.description, 'description');
  const organizer = parseOptionalText(req.body.organizer, 'organizer');
  const participantLimit = parseOptionalPositiveInt(req.body.participantLimit, 'participantLimit');
  const date = requireString(req.body.date, 'date');
  const eventStart = parseOptionalTime(req.body.eventStart, 'eventStart');
  const eventEnd = parseOptionalTime(req.body.eventEnd, 'eventEnd');
  const location = req.body.location ? requireString(req.body.location, 'location') : null;
  const status = parseOptionalEventStatus(req.body.status) || EVENT_STATUS.DRAFT;

  if (!isValidIsoDate(date)) {
    throw new HttpError(400, 'Campo "date" deve estar no formato YYYY-MM-DD.');
  }

  const existingEvent = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!existingEvent) {
    throw new HttpError(404, 'Evento nao encontrado.');
  }

  const event = await prisma.event.update({
    where: { id: eventId },
    data: { title, description, organizer, participantLimit, date, eventStart, eventEnd, location, status }
  });

  res.status(200).json(event);
});

// ADMIN/STAFF: lista participantes de um evento
app.get('/events/:id/participants', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  const eventId = parsePositiveInt(req.params.id);
  if (!eventId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) {
    throw new HttpError(404, 'Evento nao encontrado.');
  }

  const participants = await prisma.participant.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' }
  });

  res.status(200).json(participants);
});

// ADMIN/STAFF: busca rapida de participantes por nome/email/cpf dentro de um evento
app.get('/events/:id/participants/search', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  const eventId = parsePositiveInt(req.params.id);
  if (!eventId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  const query = requireString(req.query.q, 'q');
  if (query.length < 2) {
    throw new HttpError(400, 'Parametro "q" deve ter ao menos 2 caracteres.');
  }
  const cpfQuery = normalizeCpf(query);

  const rawLimit = req.query.limit === undefined ? 20 : parsePositiveInt(req.query.limit);
  if (!rawLimit) {
    throw new HttpError(400, 'Parametro "limit" invalido.');
  }
  const limit = Math.min(rawLimit, 100);

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) {
    throw new HttpError(404, 'Evento nao encontrado.');
  }

  const participants = await prisma.participant.findMany({
    where: {
      eventId,
      OR: [
        { name: { contains: query } },
        { email: { contains: query } },
        ...(cpfQuery ? [{ cpf: { contains: cpfQuery } }] : [])
      ]
    },
    orderBy: { name: 'asc' },
    take: limit
  });

  res.status(200).json(participants);
});

// ADMIN: remove evento e dados vinculados em transacao
app.delete('/admin/events/:id', authenticate, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  const eventId = parsePositiveInt(req.params.id);
  if (!eventId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) {
    throw new HttpError(404, 'Evento nao encontrado.');
  }

  await prisma.$transaction([
    prisma.checkInLog.deleteMany({ where: { eventId } }),
    prisma.participant.deleteMany({ where: { eventId } }),
    prisma.event.delete({ where: { id: eventId } })
  ]);

  res.status(204).send();
});

// ADMIN: cria participante vinculado ao evento
app.post('/admin/participants', authenticate, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  const name = requireString(req.body.name, 'name');
  const email = requireEmail(req.body.email);
  const cpf = requireCpf(req.body.cpf);
  const phone = parseOptionalText(req.body.phone, 'phone');
  const institution = parseOptionalText(req.body.institution, 'institution');
  const jobTitle = parseOptionalText(req.body.jobTitle, 'jobTitle');
  const city = parseOptionalText(req.body.city, 'city');
  const uf = parseOptionalUf(req.body.uf);
  const category = parseParticipantCategory(req.body.category);
  const eventId = parsePositiveInt(req.body.eventId);

  if (!eventId) {
    throw new HttpError(400, 'Campo "eventId" invalido.');
  }

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) {
    throw new HttpError(404, 'Evento nao encontrado para associar participante.');
  }

  const participant = await prisma.participant.create({
    data: { name, email, cpf, phone, institution, jobTitle, city, uf, category, eventId }
  });

  res.status(201).json(participant);
});

// ADMIN: atualiza participante
app.put('/admin/participants/:id', authenticate, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  const participantId = parsePositiveInt(req.params.id);
  if (!participantId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  const name = requireString(req.body.name, 'name');
  const email = requireEmail(req.body.email);
  const cpf = requireCpf(req.body.cpf);
  const phone = parseOptionalText(req.body.phone, 'phone');
  const institution = parseOptionalText(req.body.institution, 'institution');
  const jobTitle = parseOptionalText(req.body.jobTitle, 'jobTitle');
  const city = parseOptionalText(req.body.city, 'city');
  const uf = parseOptionalUf(req.body.uf);
  const category = parseParticipantCategory(req.body.category);

  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    select: { id: true }
  });

  if (!participant) {
    throw new HttpError(404, 'Participante nao encontrado.');
  }

  const updatedParticipant = await prisma.participant.update({
    where: { id: participantId },
    data: { name, email, cpf, phone, institution, jobTitle, city, uf, category }
  });

  res.status(200).json(updatedParticipant);
});

// STAFF/ADMIN: faz check-in e registra auditoria
app.patch('/staff/participants/:id/check-in', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  const participantId = parsePositiveInt(req.params.id);
  if (!participantId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  const checkIn = req.body.checkIn === undefined ? true : requireBoolean(req.body.checkIn, 'checkIn');

  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    select: { id: true, checkIn: true, eventId: true }
  });

  if (!participant) {
    throw new HttpError(404, 'Participante nao encontrado.');
  }

  if (participant.checkIn === checkIn) {
    throw new HttpError(409, checkIn ? 'Participante ja esta com check-in ativo.' : 'Participante ja esta sem check-in.');
  }

  const action = checkIn ? 'CHECK_IN' : 'UNDO_CHECK_IN';

  const updatedParticipant = await prisma.$transaction(async (tx) => {
    const changed = await tx.participant.update({
      where: { id: participantId },
      data: {
        checkIn,
        checkedInAt: checkIn ? new Date() : null
      }
    });

    await tx.checkInLog.create({
      data: {
        participantId: participant.id,
        eventId: participant.eventId,
        actorUserId: req.user.id,
        action
      }
    });

    return changed;
  });

  res.status(200).json(updatedParticipant);
});

// ADMIN: remove participante e logs de check-in
app.delete('/admin/participants/:id', authenticate, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  const participantId = parsePositiveInt(req.params.id);
  if (!participantId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    select: { id: true }
  });

  if (!participant) {
    throw new HttpError(404, 'Participante nao encontrado.');
  }

  await prisma.$transaction([
    prisma.checkInLog.deleteMany({ where: { participantId } }),
    prisma.participant.delete({ where: { id: participantId } })
  ]);

  res.status(204).send();
});

// ADMIN: consulta trilha de auditoria de check-in por evento
app.get('/admin/events/:id/check-in-logs', authenticate, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  const eventId = parsePositiveInt(req.params.id);
  if (!eventId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) {
    throw new HttpError(404, 'Evento nao encontrado.');
  }

  const logs = await prisma.checkInLog.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
    include: {
      participant: { select: { id: true, name: true, email: true } },
      actor: { select: { id: true, name: true, email: true, role: true } }
    }
  });

  res.status(200).json(logs);
});

// ADMIN/STAFF: baixa relatorio CSV de um evento
app.get('/events/:id/report.csv', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  const eventId = parsePositiveInt(req.params.id);
  if (!eventId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new HttpError(404, 'Evento nao encontrado.');
  }

  const participants = await prisma.participant.findMany({
    where: { eventId },
    orderBy: { name: 'asc' }
  });

  const headers = [
    'id',
    'name',
    'email',
    'cpf',
    'phone',
    'institution',
    'jobTitle',
    'city',
    'uf',
    'category',
    'checkIn',
    'checkedInAt',
    'createdAt'
  ];

  const rows = participants.map((participant) => ([
    participant.id,
    participant.name,
    participant.email,
    participant.cpf,
    participant.phone,
    participant.institution,
    participant.jobTitle,
    participant.city,
    participant.uf,
    participant.category,
    participant.checkIn,
    participant.checkedInAt ? participant.checkedInAt.toISOString() : '',
    participant.createdAt ? participant.createdAt.toISOString() : ''
  ].map(csvCell).join(',')));

  const csv = [headers.map(csvCell).join(','), ...rows].join('\n');
  const safeTitle = String(event.title || 'evento').replace(/[^\w\-]+/g, '_');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="relatorio_${safeTitle}_${event.id}.csv"`);
  res.status(200).send(csv);
});

// ADMIN/STAFF: dados agregados para dashboard
app.get('/dashboard', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  const totalEventos = await prisma.event.count();
  const totalParticipantes = await prisma.participant.count();
  const totalCheckIns = await prisma.participant.count({ where: { checkIn: true } });

  res.status(200).json({
    eventos: totalEventos,
    participantes: totalParticipantes,
    checkIns: totalCheckIns
  });
});

// Middleware centralizado para respostas de erro
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err && err.code === 'P2002') {
    return res.status(409).json({ error: 'Registro duplicado.' });
  }

  if (err && err.code === 'P2025') {
    return res.status(404).json({ error: 'Registro nao encontrado.' });
  }

  if (err && err.code === 'P2003') {
    return res.status(400).json({ error: 'Violacao de referencia entre tabelas.' });
  }

  console.error(err);
  return res.status(500).json({ error: 'Erro interno do servidor.' });
});

// Inicializacao do servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
