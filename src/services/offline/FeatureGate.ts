// Feature Gate: Intelligent Cloud vs Edge Execution Dispatcher
// Decides whether an operation runs via Cloud (Gemini Vision / OSRM), Edge (COCO-SSD / Heuristics), or is Unavailable
import type { FeatureGateDecision } from '../../types';
import { connectivityMonitor } from './ConnectivityMonitor';
import { offlineQueueService } from './OfflineQueue';
import { speechManager } from '../speechSynthesis';

export type AssistiveActionType =
  | 'check_path'
  | 'describe_room'
  | 'read_text'
  | 'find_object'
  | 'find_door'
  | 'vehicle_sentinel'
  | 'route_navigation'
  | 'reverse_geocode';

export class FeatureGate {
  /**
   * Evaluates connectivity and feature capability to decide execution strategy
   */
  public evaluate(action: AssistiveActionType): FeatureGateDecision {
    const isOnline = connectivityMonitor.isOnline();
    const isDegraded = connectivityMonitor.isDegraded();

    // 1. Actions that are 100% on-device edge always
    if (
      action === 'check_path' ||
      action === 'vehicle_sentinel' ||
      action === 'find_door'
    ) {
      return 'edge';
    }

    // 2. Object Finder: Works edge-first via COCO-SSD; uses cloud only as secondary fallback
    if (action === 'find_object') {
      return 'edge';
    }

    // 3. Room Description: When offline or degraded, use local object summary; when online, use Gemini
    if (action === 'describe_room') {
      if (!isOnline || isDegraded) {
        return 'edge';
      }
      return 'cloud';
    }

    // 4. Cloud-Only Features: Reading text, online routing, address lookup
    if (
      action === 'read_text' ||
      action === 'route_navigation' ||
      action === 'reverse_geocode'
    ) {
      if (!isOnline) {
        return 'unavailable';
      }
      return 'cloud';
    }

    return isOnline ? 'cloud' : 'edge';
  }

  /**
   * Helper that checks if a cloud action can run, and if not, speaks the standard message and queues it
   */
  public handleCloudUnavailable(
    action: AssistiveActionType,
    spokenFeatureName: string,
    queueData?: any
  ): boolean {
    const decision = this.evaluate(action);
    if (decision === 'unavailable') {
      offlineQueueService.enqueue(action === 'read_text' ? 'read_text' : 'route', queueData);
      speechManager.speakReply(
        `${spokenFeatureName} needs internet. I've saved your request and will do it when you're back online.`
      );
      return true; // Action was blocked
    }
    return false; // Action is permitted to proceed
  }
}

export const featureGate = new FeatureGate();
