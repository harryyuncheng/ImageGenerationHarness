export class RepositoryUnavailableError extends Error {
  constructor(message = 'No local image repository is active.') {
    super(message);
    this.name = 'RepositoryUnavailableError';
  }
}
