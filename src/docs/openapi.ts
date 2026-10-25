type OpenApiSchema = Record<string, unknown>;
type QueryParameter = {
  name: string;
  type: string;
  required?: boolean;
  enum?: string[];
  format?: string;
  minimum?: number;
  maximum?: number;
  default?: string | number;
};
type Endpoint = {
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
  tag: string;
  summary: string;
  auth: boolean;
  status: string;
  success: string;
  pathParams?: string[];
  query?: QueryParameter[];
  body?: { required: string[]; properties: Record<string, OpenApiSchema> };
  errors?: string[];
};

const uuid = { type: 'string', format: 'uuid' };
const date = { type: 'string', format: 'date', nullable: true };
const role = { type: 'string', enum: ['ADMIN', 'MANAGER', 'MEMBER'] };
const projectStatus = {
  type: 'string',
  enum: ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'],
};
const taskStatus = {
  type: 'string',
  enum: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'],
};
const taskPriority = { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] };
const pageParameters: QueryParameter[] = [
  { name: 'page', type: 'integer', minimum: 1, default: 1 },
  { name: 'perPage', type: 'integer', minimum: 1, maximum: 100, default: 20 },
];
const clientFields = {
  name: { type: 'string', minLength: 1, maxLength: 150 },
  email: { type: 'string', format: 'email', nullable: true },
  phone: { type: 'string', maxLength: 40, nullable: true },
};
const projectFields = {
  clientId: uuid,
  name: { type: 'string', maxLength: 150 },
  description: { type: 'string', nullable: true },
  status: projectStatus,
  startDate: date,
  dueDate: date,
};
const taskFields = {
  title: { type: 'string', maxLength: 200 },
  description: { type: 'string', nullable: true },
  priority: taskPriority,
  dueDate: date,
  assigneeId: { ...uuid, nullable: true },
};

const endpoints: Endpoint[] = [
  {
    method: 'get',
    path: '/health',
    tag: 'Health',
    summary: 'Check API and database readiness',
    auth: false,
    status: '200',
    success: 'Service and database are healthy.',
    errors: ['503'],
  },
  {
    method: 'post',
    path: '/auth/register',
    tag: 'Auth',
    summary: 'Register a MEMBER account; endpoint is rate-limited',
    auth: false,
    status: '201',
    success: 'Returns public user details and a short-lived access token.',
    body: {
      required: ['email', 'password', 'name'],
      properties: {
        email: { type: 'string', format: 'email', maxLength: 254 },
        password: { type: 'string', minLength: 12, maxLength: 128 },
        name: { type: 'string', minLength: 2, maxLength: 100 },
      },
    },
    errors: ['400', '409', '429'],
  },
  {
    method: 'post',
    path: '/auth/login',
    tag: 'Auth',
    summary: 'Authenticate with email and password; endpoint is rate-limited',
    auth: false,
    status: '200',
    success: 'Returns public user details and a short-lived access token.',
    body: {
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', maxLength: 254 },
        password: { type: 'string', minLength: 1, maxLength: 128 },
      },
    },
    errors: ['400', '401', '429'],
  },
  {
    method: 'get',
    path: '/users/me',
    tag: 'Users',
    summary: 'Get the authenticated user profile',
    auth: true,
    status: '200',
    success: 'Current user public profile.',
    errors: ['401'],
  },
  {
    method: 'get',
    path: '/users',
    tag: 'Users',
    summary: 'List users (ADMIN and MANAGER)',
    auth: true,
    status: '200',
    success: 'Paginated public user profiles.',
    query: [
      ...pageParameters,
      { name: 'role', type: 'string', enum: ['ADMIN', 'MANAGER', 'MEMBER'] },
      { name: 'isActive', type: 'string', enum: ['true', 'false'] },
    ],
    errors: ['400', '401', '403'],
  },
  {
    method: 'patch',
    path: '/users/{userId}/role',
    tag: 'Users',
    summary: 'Change a user role (ADMIN only)',
    auth: true,
    status: '200',
    success: 'Updated public user profile.',
    pathParams: ['userId'],
    body: { required: ['role'], properties: { role } },
    errors: ['400', '401', '403', '404', '409'],
  },
  {
    method: 'get',
    path: '/clients',
    tag: 'Clients',
    summary: 'List clients; members see clients associated with their projects',
    auth: true,
    status: '200',
    success: 'Paginated clients.',
    query: [
      ...pageParameters,
      { name: 'search', type: 'string' },
      {
        name: 'sortBy',
        type: 'string',
        enum: ['name', 'createdAt', 'updatedAt'],
        default: 'createdAt',
      },
      { name: 'sortOrder', type: 'string', enum: ['asc', 'desc'], default: 'desc' },
    ],
    errors: ['400', '401'],
  },
  {
    method: 'post',
    path: '/clients',
    tag: 'Clients',
    summary: 'Create a client (ADMIN or MANAGER)',
    auth: true,
    status: '201',
    success: 'Created client.',
    body: { required: ['name'], properties: clientFields },
    errors: ['400', '401', '403'],
  },
  {
    method: 'get',
    path: '/clients/{clientId}',
    tag: 'Clients',
    summary: 'Get a client within the caller’s project scope',
    auth: true,
    status: '200',
    success: 'Client details.',
    pathParams: ['clientId'],
    errors: ['400', '401', '404'],
  },
  {
    method: 'patch',
    path: '/clients/{clientId}',
    tag: 'Clients',
    summary: 'Update a client (ADMIN or MANAGER)',
    auth: true,
    status: '200',
    success: 'Updated client.',
    pathParams: ['clientId'],
    body: { required: [], properties: clientFields },
    errors: ['400', '401', '403', '404'],
  },
  {
    method: 'delete',
    path: '/clients/{clientId}',
    tag: 'Clients',
    summary: 'Delete a client without projects (ADMIN or MANAGER)',
    auth: true,
    status: '204',
    success: 'Client deleted.',
    pathParams: ['clientId'],
    errors: ['400', '401', '403', '404', '409'],
  },
  {
    method: 'get',
    path: '/projects',
    tag: 'Projects',
    summary: 'List projects; members see projects they joined',
    auth: true,
    status: '200',
    success: 'Paginated projects.',
    query: [
      ...pageParameters,
      { name: 'clientId', type: 'string', format: 'uuid' },
      {
        name: 'status',
        type: 'string',
        enum: ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'],
      },
      { name: 'sortBy', type: 'string', enum: ['name', 'createdAt', 'dueDate', 'status'] },
      { name: 'sortOrder', type: 'string', enum: ['asc', 'desc'] },
    ],
    errors: ['400', '401'],
  },
  {
    method: 'post',
    path: '/projects',
    tag: 'Projects',
    summary: 'Create a project (ADMIN or MANAGER)',
    auth: true,
    status: '201',
    success: 'Created project.',
    body: { required: ['clientId', 'name'], properties: projectFields },
    errors: ['400', '401', '403', '404'],
  },
  {
    method: 'get',
    path: '/projects/{projectId}',
    tag: 'Projects',
    summary: 'Get an accessible project',
    auth: true,
    status: '200',
    success: 'Project and client details.',
    pathParams: ['projectId'],
    errors: ['400', '401', '404'],
  },
  {
    method: 'patch',
    path: '/projects/{projectId}',
    tag: 'Projects',
    summary: 'Update a project (ADMIN or MANAGER)',
    auth: true,
    status: '200',
    success: 'Updated project.',
    pathParams: ['projectId'],
    body: { required: [], properties: projectFields },
    errors: ['400', '401', '403', '404'],
  },
  {
    method: 'delete',
    path: '/projects/{projectId}',
    tag: 'Projects',
    summary: 'Delete project, memberships, and tasks (ADMIN or MANAGER)',
    auth: true,
    status: '204',
    success: 'Project deleted.',
    pathParams: ['projectId'],
    errors: ['400', '401', '403', '404'],
  },
  {
    method: 'get',
    path: '/projects/{projectId}/members',
    tag: 'Projects',
    summary: 'List project members for an accessible project',
    auth: true,
    status: '200',
    success: 'Paginated membership records.',
    pathParams: ['projectId'],
    query: pageParameters,
    errors: ['400', '401', '404'],
  },
  {
    method: 'post',
    path: '/projects/{projectId}/members',
    tag: 'Projects',
    summary: 'Add a member to a project (ADMIN or MANAGER)',
    auth: true,
    status: '201',
    success: 'Created project membership.',
    pathParams: ['projectId'],
    body: { required: ['userId'], properties: { userId: uuid } },
    errors: ['400', '401', '403', '404', '409'],
  },
  {
    method: 'delete',
    path: '/projects/{projectId}/members/{userId}',
    tag: 'Projects',
    summary: 'Remove a project member; assigned tasks must be reassigned first',
    auth: true,
    status: '204',
    success: 'Project membership removed.',
    pathParams: ['projectId', 'userId'],
    errors: ['400', '401', '403', '404', '409'],
  },
  {
    method: 'get',
    path: '/projects/{projectId}/tasks',
    tag: 'Tasks',
    summary: 'List tasks in an accessible project',
    auth: true,
    status: '200',
    success: 'Paginated tasks.',
    pathParams: ['projectId'],
    query: [
      ...pageParameters,
      {
        name: 'status',
        type: 'string',
        enum: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'],
      },
      { name: 'priority', type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
      { name: 'assigneeId', type: 'string', format: 'uuid' },
      {
        name: 'sortBy',
        type: 'string',
        enum: ['createdAt', 'dueDate', 'priority', 'status', 'title'],
      },
      { name: 'sortOrder', type: 'string', enum: ['asc', 'desc'] },
    ],
    errors: ['400', '401', '404'],
  },
  {
    method: 'post',
    path: '/projects/{projectId}/tasks',
    tag: 'Tasks',
    summary: 'Create a task (ADMIN, MANAGER, or project member)',
    auth: true,
    status: '201',
    success: 'Created task.',
    pathParams: ['projectId'],
    body: { required: ['title'], properties: taskFields },
    errors: ['400', '401', '403', '404', '409'],
  },
  {
    method: 'get',
    path: '/tasks/{taskId}',
    tag: 'Tasks',
    summary: 'Get a task if its project is accessible',
    auth: true,
    status: '200',
    success: 'Task details.',
    pathParams: ['taskId'],
    errors: ['400', '401', '404'],
  },
  {
    method: 'patch',
    path: '/tasks/{taskId}',
    tag: 'Tasks',
    summary: 'Edit task details (ADMIN, MANAGER, or task creator)',
    auth: true,
    status: '200',
    success: 'Updated task.',
    pathParams: ['taskId'],
    body: { required: [], properties: taskFields },
    errors: ['400', '401', '403', '404', '409'],
  },
  {
    method: 'patch',
    path: '/tasks/{taskId}/assignee',
    tag: 'Tasks',
    summary: 'Assign a task to a project member (ADMIN or MANAGER)',
    auth: true,
    status: '200',
    success: 'Updated task assignment.',
    pathParams: ['taskId'],
    body: { required: ['assigneeId'], properties: { assigneeId: { ...uuid, nullable: true } } },
    errors: ['400', '401', '403', '404', '409'],
  },
  {
    method: 'patch',
    path: '/tasks/{taskId}/status',
    tag: 'Tasks',
    summary: 'Change status (ADMIN, MANAGER, assignee, or task creator)',
    auth: true,
    status: '200',
    success: 'Updated task status and activity record.',
    pathParams: ['taskId'],
    body: { required: ['status'], properties: { status: taskStatus } },
    errors: ['400', '401', '403', '404'],
  },
  {
    method: 'get',
    path: '/analytics/overview',
    tag: 'Analytics',
    summary: 'Get project and task totals; member results are project-scoped',
    auth: true,
    status: '200',
    success: 'Project totals, task totals, overdue tasks, and task status counts.',
    query: [
      { name: 'from', type: 'string', format: 'date' },
      { name: 'to', type: 'string', format: 'date' },
    ],
    errors: ['400', '401'],
  },
];

const commonErrorResponses: Record<string, OpenApiSchema> = {
  '400': {
    description: 'Invalid request input.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  '401': {
    description: 'Authentication is missing or invalid.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  '403': {
    description: 'The authenticated user lacks permission.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  '404': {
    description: 'The resource is unavailable or inaccessible.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  '409': {
    description: 'The request conflicts with current resource state.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  '429': {
    description: 'Authentication rate limit exceeded.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  '503': {
    description: 'A required service is unavailable.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
};

const paths: Record<string, Record<string, OpenApiSchema>> = {};
for (const endpoint of endpoints) {
  const parameters = [
    ...(endpoint.pathParams ?? []).map((name) => ({
      in: 'path',
      name,
      required: true,
      schema: { type: 'string', format: 'uuid' },
    })),
    ...(endpoint.query ?? []).map((parameter) => ({
      in: 'query',
      name: parameter.name,
      required: parameter.required ?? false,
      schema: {
        type: parameter.type,
        ...(parameter.enum ? { enum: parameter.enum } : {}),
        ...(parameter.format ? { format: parameter.format } : {}),
        ...(parameter.minimum === undefined ? {} : { minimum: parameter.minimum }),
        ...(parameter.maximum === undefined ? {} : { maximum: parameter.maximum }),
        ...(parameter.default === undefined ? {} : { default: parameter.default }),
      },
    })),
  ];
  paths[endpoint.path] ??= {};
  const pathItem = paths[endpoint.path];
  if (!pathItem) continue;
  const paginated =
    endpoint.method === 'get' &&
    [
      '/users',
      '/clients',
      '/projects',
      '/projects/{projectId}/members',
      '/projects/{projectId}/tasks',
    ].includes(endpoint.path);
  pathItem[endpoint.method] = {
    tags: [endpoint.tag],
    summary: endpoint.summary,
    ...(endpoint.auth ? { security: [{ bearerAuth: [] }] } : {}),
    ...(parameters.length ? { parameters } : {}),
    ...(endpoint.body
      ? {
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: endpoint.body.required,
                  additionalProperties: false,
                  properties: endpoint.body.properties,
                },
              },
            },
          },
        }
      : {}),
    responses: {
      [endpoint.status]: {
        description: endpoint.success,
        ...(endpoint.status === '204'
          ? {}
          : {
              content: {
                'application/json': {
                  schema: {
                    $ref: paginated
                      ? '#/components/schemas/PaginatedResponse'
                      : '#/components/schemas/DataResponse',
                  },
                },
              },
            }),
      },
      ...Object.fromEntries(
        (endpoint.errors ?? []).map((status) => [status, commonErrorResponses[status]]),
      ),
    },
  };
}

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'DevFlow API',
    version: '1.0.0',
    description: 'Project and client management API for a small web development agency.',
  },
  servers: [{ url: '/api/v1' }],
  tags: ['Health', 'Auth', 'Users', 'Clients', 'Projects', 'Tasks', 'Analytics'].map((name) => ({
    name,
  })),
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'array', items: { type: 'object' } },
              requestId: { type: 'string' },
            },
          },
        },
      },
      UserRole: role,
      ProjectStatus: projectStatus,
      TaskStatus: taskStatus,
      TaskPriority: taskPriority,
      PageMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          perPage: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      DataResponse: {
        type: 'object',
        required: ['data'],
        properties: { data: {}, meta: { $ref: '#/components/schemas/PageMeta' } },
      },
      PaginatedResponse: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { type: 'object' } },
          meta: { $ref: '#/components/schemas/PageMeta' },
        },
      },
    },
  },
  paths,
};
