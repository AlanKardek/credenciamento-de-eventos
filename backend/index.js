const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

// Configuracao base da aplicacao
const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const ROLES = {
  ADMIN: 'ADMIN',
  STAFF: 'STAFF'
};
const EVENT_STATUS = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  ARCHIVED: 'ARCHIVED'
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

  return parseCustomCategory(value);
}

function parseParticipantPayload(payload, rowNumber) {
  const prefix = rowNumber ? `Linha ${rowNumber}: ` : '';

  try {
    return {
      name: requireString(payload.name, 'name'),
      email: requireEmail(payload.email),
      cpf: requireCpf(payload.cpf),
      phone: parseOptionalText(payload.phone, 'phone'),
      institution: parseOptionalText(payload.institution, 'institution'),
      jobTitle: parseOptionalText(payload.jobTitle, 'jobTitle'),
      city: parseOptionalText(payload.city, 'city'),
      uf: parseOptionalUf(payload.uf),
      category: parseParticipantCategory(payload.category)
    };
  } catch (error) {
    if (error instanceof HttpError && rowNumber) {
      throw new HttpError(error.status, `${prefix}${error.message}`);
    }

    throw error;
  }
}

function ensureNoImportDuplicates(participants) {
  const emails = new Set();
  const cpfs = new Set();

  participants.forEach((participant, index) => {
    const rowNumber = index + 2;

    if (emails.has(participant.email)) {
      throw new HttpError(400, `Linha ${rowNumber}: email duplicado na planilha.`);
    }
    emails.add(participant.email);

    if (cpfs.has(participant.cpf)) {
      throw new HttpError(400, `Linha ${rowNumber}: CPF duplicado na planilha.`);
    }
    cpfs.add(participant.cpf);
  });
}

function parseCustomCategory(value) {
  const raw = requireString(value, 'categoria');
  const normalized = normalizeCategoryInput(raw);

  if (!normalized) {
    throw new HttpError(400, 'Campo "categoria" invalido.');
  }

  if (normalized.length > 60) {
    throw new HttpError(400, 'Campo "categoria" deve ter no maximo 60 caracteres.');
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

function parseRole(value) {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'Campo "role" invalido.');
  }

  const normalized = value.toUpperCase();
  const allowed = Object.values(ROLES);
  if (!allowed.includes(normalized)) {
    throw new HttpError(400, `Campo "role" deve ser um de: ${allowed.join(', ')}.`);
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

function eventOwnerWhere(req, eventId) {
  if (req.user.role === ROLES.ADMIN) {
    return { id: eventId };
  }

  return {
    id: eventId,
    ownerUserId: req.user.id
  };
}

async function requireOwnedEvent(req, eventId, select) {
  const event = await prisma.event.findFirst({
    where: eventOwnerWhere(req, eventId),
    ...(select ? { select } : {})
  });

  if (!event) {
    throw new HttpError(404, 'Evento nao encontrado.');
  }

  return event;
}

async function requireOwnedParticipant(req, participantId, select) {
  const where = req.user.role === ROLES.ADMIN
    ? { id: participantId }
    : {
        id: participantId,
        event: {
          ownerUserId: req.user.id
        }
      };

  const participant = await prisma.participant.findFirst({
    where,
    ...(select ? { select } : {})
  });

  if (!participant) {
    throw new HttpError(404, 'Participante nao encontrado.');
  }

  return participant;
}

// Healthcheck simples para confirmar backend no ar
app.get('/', (req, res) => {
  res.send('API de credenciamento rodando.');
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

// Atualiza o perfil do usuario autenticado
app.put('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    throw new HttpError(404, 'Usuario nao encontrado.');
  }

  const name = requireString(req.body.name, 'name');
  const email = requireEmail(req.body.email);
  const currentPassword = parseOptionalText(req.body.currentPassword, 'currentPassword');
  const password = parseOptionalText(req.body.password, 'password');

  if (password && password.length < 6) {
    throw new HttpError(400, 'A nova senha deve ter no minimo 6 caracteres.');
  }

  if (password && !currentPassword) {
    throw new HttpError(400, 'Informe a senha atual para definir uma nova senha.');
  }

  if (!password && currentPassword) {
    throw new HttpError(400, 'Informe a nova senha.');
  }

  if (password) {
    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!validPassword) {
      throw new HttpError(401, 'Senha atual incorreta.');
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      email,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {})
    }
  });

  const token = signToken(updatedUser);
  res.status(200).json({ user: sanitizeUser(updatedUser), token });
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

// ADMIN: cria conta de cliente com permissao para gerenciar os proprios eventos
app.post('/admin/users/client', authenticate, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  const name = requireString(req.body.name, 'name');
  const email = requireEmail(req.body.email);
  const password = requireString(req.body.password, 'password');

  if (password.length < 6) {
    throw new HttpError(400, 'A senha deve ter no minimo 6 caracteres.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const client = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: ROLES.ADMIN
    }
  });

  res.status(201).json(sanitizeUser(client));
});

// ADMIN: lista usuarios para gerenciamento
app.get('/admin/users', authenticate, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { id: 'asc' },
    include: {
      _count: {
        select: {
          ownedEvents: true,
          checkInActions: true
        }
      }
    }
  });

  res.status(200).json(users.map((user) => ({
    ...sanitizeUser(user),
    ownedEventsCount: user._count.ownedEvents,
    checkInActionsCount: user._count.checkInActions
  })));
});

// ADMIN: atualiza permissao e dados de login de outro usuario
app.put('/admin/users/:id', authenticate, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  const userId = parsePositiveInt(req.params.id);
  if (!userId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  if (userId === req.user.id) {
    throw new HttpError(400, 'Use a tela de perfil para alterar a propria conta.');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError(404, 'Usuario nao encontrado.');
  }

  const name = requireString(req.body.name, 'name');
  const email = requireEmail(req.body.email);
  const role = parseRole(req.body.role);
  const password = parseOptionalText(req.body.password, 'password');

  if (password && password.length < 6) {
    throw new HttpError(400, 'A senha deve ter no minimo 6 caracteres.');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      email,
      role,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {})
    }
  });

  res.status(200).json(sanitizeUser(updatedUser));
});

// ADMIN/STAFF: cria evento proprio
app.post('/admin/events', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
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
    data: {
      title,
      description,
      organizer,
      participantLimit,
      date,
      eventStart,
      eventEnd,
      location,
      status,
      ownerUserId: req.user.id
    }
  });

  res.status(201).json(event);
});

// ADMIN/STAFF: lista eventos
app.get('/events', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  const events = await prisma.event.findMany({
    ...(req.user.role === ROLES.ADMIN ? {} : { where: { ownerUserId: req.user.id } }),
    orderBy: { id: 'desc' }
  });
  res.status(200).json(events);
});

// ADMIN/STAFF: detalhe de evento
app.get('/events/:id', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  const eventId = parsePositiveInt(req.params.id);
  if (!eventId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  const event = await requireOwnedEvent(req, eventId);

  res.status(200).json(event);
});

// ADMIN/STAFF: atualiza evento proprio
app.put('/admin/events/:id', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
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

  await requireOwnedEvent(req, eventId, { id: true });

  const event = await prisma.event.update({
    where: { id: eventId },
    data: { title, description, organizer, participantLimit, date, eventStart, eventEnd, location, status }
  });

  res.status(200).json(event);
});

// ADMIN: transfere a propriedade de um evento para outra conta de acesso
app.patch('/admin/events/:id/owner', authenticate, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  const eventId = parsePositiveInt(req.params.id);
  if (!eventId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  const targetUserId = parsePositiveInt(req.body.targetUserId);
  if (!targetUserId) {
    throw new HttpError(400, 'Campo "targetUserId" invalido.');
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new HttpError(404, 'Evento nao encontrado.');
  }

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) {
    throw new HttpError(404, 'Conta de destino nao encontrada.');
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: { ownerUserId: targetUserId }
  });

  res.status(200).json(updated);
});

// ADMIN/STAFF: lista participantes de um evento
app.get('/events/:id/participants', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  const eventId = parsePositiveInt(req.params.id);
  if (!eventId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  await requireOwnedEvent(req, eventId, { id: true });

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

  await requireOwnedEvent(req, eventId, { id: true });

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

// ADMIN/STAFF: remove evento proprio e dados vinculados em transacao
app.delete('/admin/events/:id', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  const eventId = parsePositiveInt(req.params.id);
  if (!eventId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  await requireOwnedEvent(req, eventId, { id: true });

  await prisma.$transaction([
    prisma.checkInLog.deleteMany({ where: { eventId } }),
    prisma.participant.deleteMany({ where: { eventId } }),
    prisma.event.delete({ where: { id: eventId } })
  ]);

  res.status(204).send();
});

// ADMIN/STAFF: cria participante vinculado ao evento proprio
app.post('/admin/participants', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  const participantData = parseParticipantPayload(req.body);
  const eventId = parsePositiveInt(req.body.eventId);

  if (!eventId) {
    throw new HttpError(400, 'Campo "eventId" invalido.');
  }

  await requireOwnedEvent(req, eventId, { id: true });

  const participant = await prisma.participant.create({
    data: {
      ...participantData,
      eventId,
      activityLogs: {
        create: {
          actorUserId: req.user.id,
          action: 'CREATED',
          message: 'Participante cadastrado manualmente.'
        }
      }
    }
  });

  res.status(201).json(participant);
});

// ADMIN/STAFF: importa participantes em lote para um evento proprio
app.post('/admin/events/:id/participants/import', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  const eventId = parsePositiveInt(req.params.id);
  if (!eventId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  if (!Array.isArray(req.body.participants)) {
    throw new HttpError(400, 'Campo "participants" deve ser uma lista.');
  }

  if (req.body.participants.length === 0) {
    throw new HttpError(400, 'A planilha nao possui participantes para importar.');
  }

  if (req.body.participants.length > 1000) {
    throw new HttpError(400, 'Importe no maximo 1000 participantes por arquivo.');
  }

  await requireOwnedEvent(req, eventId, { id: true });

  const participantsToImport = req.body.participants.map((participant, index) =>
    parseParticipantPayload(participant, index + 2)
  );
  ensureNoImportDuplicates(participantsToImport);

  const existingParticipants = await prisma.participant.findMany({
    where: {
      eventId,
      OR: [
        { email: { in: participantsToImport.map((participant) => participant.email) } },
        { cpf: { in: participantsToImport.map((participant) => participant.cpf) } }
      ]
    },
    select: { email: true, cpf: true }
  });

  if (existingParticipants.length > 0) {
    const existingEmails = new Set(existingParticipants.map((participant) => participant.email));
    const existingCpfs = new Set(existingParticipants.map((participant) => participant.cpf).filter(Boolean));
    const duplicatedRowIndex = participantsToImport.findIndex((participant) =>
      existingEmails.has(participant.email) || existingCpfs.has(participant.cpf)
    );
    const duplicatedParticipant = participantsToImport[duplicatedRowIndex];
    const duplicatedField = existingEmails.has(duplicatedParticipant.email) ? 'email' : 'CPF';

    throw new HttpError(409, `Linha ${duplicatedRowIndex + 2}: ${duplicatedField} ja cadastrado neste evento.`);
  }

  const createdParticipants = await prisma.$transaction(
    participantsToImport.map((participant) =>
      prisma.participant.create({
        data: {
          ...participant,
          eventId,
          activityLogs: {
            create: {
              actorUserId: req.user.id,
              action: 'CREATED',
              message: 'Participante importado por planilha.'
            }
          }
        }
      })
    )
  );

  res.status(201).json({
    imported: createdParticipants.length,
    participants: createdParticipants
  });
});

// ADMIN/STAFF: atualiza participante de evento proprio
app.put('/admin/participants/:id', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
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

  await requireOwnedParticipant(req, participantId, { id: true });

  const updatedParticipant = await prisma.participant.update({
    where: { id: participantId },
    data: {
      name,
      email,
      cpf,
      phone,
      institution,
      jobTitle,
      city,
      uf,
      category,
      activityLogs: {
        create: {
          actorUserId: req.user.id,
          action: 'UPDATED',
          message: 'Dados cadastrais atualizados.'
        }
      }
    }
  });

  res.status(200).json(updatedParticipant);
});

// ADMIN/STAFF: consulta linha do tempo operacional do participante
app.get('/admin/participants/:id/activity-logs', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  const participantId = parsePositiveInt(req.params.id);
  if (!participantId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  const participant = await requireOwnedParticipant(req, participantId, {
    id: true,
    eventId: true,
    name: true,
    checkIn: true,
    checkedInAt: true,
    createdAt: true,
    updatedAt: true
  });

  const [activityLogs, checkInLogs] = await Promise.all([
    prisma.participantActivityLog.findMany({
      where: { participantId },
      include: { actor: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.checkInLog.findMany({
      where: { participantId },
      include: { actor: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  const logs = [
    {
      id: `created-${participant.id}`,
      action: 'CREATED',
      message: 'Cadastro do participante criado.',
      createdAt: participant.createdAt,
      actor: null
    },
    ...activityLogs.map((log) => ({
      id: `activity-${log.id}`,
      action: log.action,
      message: log.message,
      createdAt: log.createdAt,
      actor: log.actor
    })),
    ...checkInLogs.map((log) => ({
      id: `checkin-${log.id}`,
      action: log.action,
      message: log.action === 'CHECK_IN' ? 'Check-in realizado via QR Code.' : 'Check-in removido.',
      createdAt: log.createdAt,
      actor: log.actor
    }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.status(200).json({
    participant,
    logs
  });
});

// ADMIN/STAFF: registra impressao/reimpressao de cracha
app.post('/admin/participants/:id/print-badge', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  const participantId = parsePositiveInt(req.params.id);
  if (!participantId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  await requireOwnedParticipant(req, participantId, { id: true });

  const log = await prisma.participantActivityLog.create({
    data: {
      participantId,
      actorUserId: req.user.id,
      action: 'BADGE_PRINTED',
      message: 'Crachá enviado para impressão.'
    },
    include: { actor: { select: { id: true, name: true, email: true, role: true } } }
  });

  res.status(201).json(log);
});

// ADMIN/STAFF: renomeia uma categoria em todos os participantes do evento proprio
app.patch('/admin/events/:id/categories/:categoryKey', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  const eventId = parsePositiveInt(req.params.id);
  if (!eventId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  const currentCategory = normalizeCategoryInput(requireString(req.params.categoryKey, 'categoryKey'));
  if (!currentCategory) {
    throw new HttpError(400, 'Parametro "categoryKey" invalido.');
  }

  const nextCategory = parseCustomCategory(req.body.category);

  await requireOwnedEvent(req, eventId, { id: true });

  const updated = await prisma.participant.updateMany({
    where: {
      eventId,
      category: currentCategory
    },
    data: {
      category: nextCategory
    }
  });

  res.status(200).json({ category: nextCategory, updatedCount: updated.count });
});

// ADMIN/STAFF: exclui uma categoria do evento proprio movendo participantes para PUBLICO_GERAL
app.delete('/admin/events/:id/categories/:categoryKey', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  const eventId = parsePositiveInt(req.params.id);
  if (!eventId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  const category = normalizeCategoryInput(requireString(req.params.categoryKey, 'categoryKey'));
  if (!category) {
    throw new HttpError(400, 'Parametro "categoryKey" invalido.');
  }

  await requireOwnedEvent(req, eventId, { id: true });

  const updated = await prisma.participant.updateMany({
    where: {
      eventId,
      category
    },
    data: {
      category: PARTICIPANT_CATEGORY.PUBLICO_GERAL
    }
  });

  res.status(200).json({ movedTo: PARTICIPANT_CATEGORY.PUBLICO_GERAL, updatedCount: updated.count });
});

// STAFF/ADMIN: faz check-in e registra auditoria
app.patch('/staff/participants/:id/check-in', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  const participantId = parsePositiveInt(req.params.id);
  if (!participantId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  const checkIn = req.body.checkIn === undefined ? true : requireBoolean(req.body.checkIn, 'checkIn');

  const participant = await requireOwnedParticipant(req, participantId, { id: true, checkIn: true, eventId: true });

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

// ADMIN/STAFF: remove participante de evento proprio e logs de check-in
app.delete('/admin/participants/:id', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  const participantId = parsePositiveInt(req.params.id);
  if (!participantId) {
    throw new HttpError(400, 'Parametro "id" invalido.');
  }

  await requireOwnedParticipant(req, participantId, { id: true });

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

  await requireOwnedEvent(req, eventId, { id: true });

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

  const event = await requireOwnedEvent(req, eventId);

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
  const totalEventos = await prisma.event.count({ where: { ownerUserId: req.user.id } });
  const totalParticipantes = await prisma.participant.count({
    where: { event: { ownerUserId: req.user.id } }
  });
  const totalCheckIns = await prisma.participant.count({
    where: { checkIn: true, event: { ownerUserId: req.user.id } }
  });

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
