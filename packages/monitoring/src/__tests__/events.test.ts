/**
 * Tests for the monitoring events module.
 *
 * We test that trackEvent and trackError call the expected Sentry methods,
 * and that they no-op gracefully when Sentry is not initialized.
 */

import { trackEvent, trackError } from '../events';
import { initMonitoring, type SentryLike } from '../init';

// ---------------------------------------------------------------------------
// Mock Sentry instance
// ---------------------------------------------------------------------------

function createMockSentry(): SentryLike & {
  init: jest.Mock;
  setTag: jest.Mock;
  setUser: jest.Mock;
  captureException: jest.Mock;
  captureMessage: jest.Mock;
  addBreadcrumb: jest.Mock;
} {
  return {
    init: jest.fn(),
    setTag: jest.fn(),
    setUser: jest.fn(),
    captureException: jest.fn(() => 'event-id-123'),
    captureMessage: jest.fn(() => 'event-id-456'),
    addBreadcrumb: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// No-op when not initialized
// ---------------------------------------------------------------------------

describe('when monitoring is NOT initialized', () => {
  // These tests rely on a fresh module state where initMonitoring has NOT
  // been called. We use jest.isolateModules to get fresh module instances.

  it('trackEvent does not throw', () => {
    jest.isolateModules(() => {
      const { trackEvent: freshTrackEvent } = require('../events');
      expect(() => freshTrackEvent({ name: 'app_opened', platform: 'ios' })).not.toThrow();
    });
  });

  it('trackError does not throw', () => {
    jest.isolateModules(() => {
      const { trackError: freshTrackError } = require('../events');
      expect(() => freshTrackError(new Error('fail'))).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// trackEvent
// ---------------------------------------------------------------------------

describe('trackEvent', () => {
  let mockSentry: ReturnType<typeof createMockSentry>;

  beforeEach(() => {
    mockSentry = createMockSentry();
    initMonitoring(mockSentry, {
      dsn: 'https://test@sentry.io/123',
      environment: 'development',
      platform: 'desktop',
      appVersion: '1.0.0',
    });
  });

  it('adds a breadcrumb with category "analytics"', () => {
    trackEvent({ name: 'signup_completed' });
    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'analytics',
        message: 'signup_completed',
        level: 'info',
      }),
    );
  });

  it('calls captureMessage with the event name', () => {
    trackEvent({ name: 'app_opened', platform: 'ios' });
    expect(mockSentry.captureMessage).toHaveBeenCalledWith('[event] app_opened');
  });

  it('includes extra data in breadcrumb for events with payload', () => {
    trackEvent({ name: 'content_flagged', confidence: 95, source: 'rekognition' });
    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ confidence: 95, source: 'rekognition' }),
      }),
    );
  });

  it('does not include data for events without payload', () => {
    trackEvent({ name: 'signup_completed' });
    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        data: undefined,
      }),
    );
  });

  it('calls both addBreadcrumb and captureMessage for each event', () => {
    trackEvent({ name: 'streak_milestone', days: 30 });
    expect(mockSentry.addBreadcrumb).toHaveBeenCalledTimes(1);
    expect(mockSentry.captureMessage).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// trackError
// ---------------------------------------------------------------------------

describe('trackError', () => {
  let mockSentry: ReturnType<typeof createMockSentry>;

  beforeEach(() => {
    mockSentry = createMockSentry();
    initMonitoring(mockSentry, {
      dsn: 'https://test@sentry.io/123',
      environment: 'development',
      platform: 'mobile',
      appVersion: '1.0.0',
    });
  });

  it('calls captureException with the error', () => {
    const err = new Error('something broke');
    trackError(err);
    expect(mockSentry.captureException).toHaveBeenCalledWith(err);
  });

  it('adds a context breadcrumb when context is provided', () => {
    trackError(new Error('fail'), { userId: 'u1', action: 'save' });
    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'error-context',
        level: 'error',
        data: { userId: 'u1', action: 'save' },
      }),
    );
  });

  it('does not add a context breadcrumb when context is omitted', () => {
    trackError(new Error('fail'));
    expect(mockSentry.addBreadcrumb).not.toHaveBeenCalled();
  });

  it('handles non-Error objects passed as the error argument', () => {
    trackError('string error');
    expect(mockSentry.captureException).toHaveBeenCalledWith('string error');
  });

  it('handles null error gracefully', () => {
    trackError(null);
    expect(mockSentry.captureException).toHaveBeenCalledWith(null);
  });
});
