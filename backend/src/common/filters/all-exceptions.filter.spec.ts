import { InternalServerErrorException, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('Confidential error handling', () => {
  it.each([new Error('nationalId=private-value'), new InternalServerErrorException('password=private-value')])('does not log/return raw exceptions, stacks or query strings', exception => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host: any = { switchToHttp: () => ({ getRequest: () => ({ method: 'GET', url: '/employees?token=private-value' }), getResponse: () => response }) };
    new AllExceptionsFilter().catch(exception, host);
    const all = JSON.stringify([error.mock.calls, warn.mock.calls, response.json.mock.calls]);
    expect(all).not.toContain('private-value');
    expect(response.json.mock.calls[0][0].stack).toBeUndefined();
    expect(response.json.mock.calls[0][0].path).toBe('/employees');
    error.mockRestore(); warn.mockRestore();
  });
});
