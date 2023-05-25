import {Device} from 'react-native-ble-plx';

export interface ShowerRecords {
  showerID: number;
  avgTemp: number;
  duration: number;
  waterConsumed: number;
  timestamp: number;
  initialTemp: number;
}

export interface PeripheralType extends Device {
  connected?: boolean;
  connecting?: boolean;
}
