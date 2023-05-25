import {useEffect, useState} from 'react';
import {BleManager, Device, Service} from 'react-native-ble-plx';
import {PeripheralType, ShowerRecords} from './types';
import {Alert} from 'react-native';
import CHAR_DATA from '../model/kss_serv_char.json';
import {
  handleAndroidPermissions,
  requestLocationPermission,
} from './androidPermissions';

var Buffer = require('buffer/').Buffer;

const manager = new BleManager();

const useBLE = () => {
  const [scanActive, setScanActive] = useState<boolean>(false);
  const [peripherals, setPeripherals] = useState(
    new Map<PeripheralType['id'], PeripheralType>(),
  );
  const [peripheralsValues, setPeripheralsValues] = useState(
    new Map<string, {uuid: string; value: number}>(),
  );
  const [showerRecords, setShowerRecords] = useState<ShowerRecords[]>([]);
  const [completedShowerData, setCompletedShowerData] =
    useState<ShowerRecords | null>();
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingShowerRecords, setLoadingShowerRecords] =
    useState<boolean>(false);

  useEffect(() => {
    handleAndroidPermissions();
    requestLocationPermission();
  }, []);

  //start scanning
  async function scan() {
    const state = await manager.state();
    if (state === 'PoweredOff') return Alert.alert('Please turn on bluetooth.');

    setScanActive(true);
    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('Error while scanning: ', error);
        return;
      }

      if (device && device?.name !== null) {
        setPeripherals(map => new Map(map.set(device.id, device)));
      }

      // Check if it is a device you are looking for based on advertisement data
      // or other criteria.
      if (device?.name === 'KinetronSTFS') {
        // Stop scanning as it's not necessary if you are scanning for one device.
        stopScan();
      }
    });
  }

  //stop scanning
  function stopScan() {
    setScanActive(false);
    manager.stopDeviceScan();
  }

  const getShowersHistory = async () => {
    setLoadingShowerRecords(true);
    const devices = [...peripherals?.values()];
    const connectedDevice = devices.find(item => item?.connected);
    if (!connectedDevice) return;
    try {
      await manager.writeCharacteristicWithResponseForDevice(
        connectedDevice?.id,
        'e6221600-e12f-40f2-b0f5-aaa011c0aa8d',
        'e6221601-e12f-40f2-b0f5-aaa011c0aa8d',
        Buffer.from('1').toString('base64'),
      );
    } catch (err) {
      console.error(
        'Error while writing into download shower history characteristic [e6221601-e12f-40f2-b0f5-aaa011c0aa8d]: ',
        err,
      );
    } finally {
      setLoadingShowerRecords(false);
    }
  };

  //toggle device connection
  const togglePeripheralConnection = async (item: PeripheralType) => {
    if (item && item?.connected) {
      try {
        await manager.cancelDeviceConnection(item.id);
        setPeripherals(
          map => new Map(map.set(item.id, {...item, connected: false})),
        );
        manager.cancelTransaction('monitor_characteristics_updates');
        setPeripheralsValues(new Map());
        setCompletedShowerData(null);
        setShowerRecords([]);
        scan();
      } catch (error) {
        setLoading(false);
        manager.cancelTransaction('monitor_characteristics_updates');
        setPeripheralsValues(new Map());
        setCompletedShowerData(null);
        setShowerRecords([]);
        scan();
        console.error(
          `[togglePeripheralConnection][${item.id}] error when trying to disconnect device.`,
          error,
        );
      }
    } else {
      try {
        setPeripherals(
          map => new Map(map.set(item.id, {...item, connecting: true})),
        );
        const connection = await manager.connectToDevice(item.id);
        if (connection.id) {
          setPeripherals(
            map =>
              new Map(
                map.set(item.id, {...item, connecting: false, connected: true}),
              ),
          );
        }
        setLoading(true);
        await item.discoverAllServicesAndCharacteristics(
          'monitor_characteristics_updates',
        );
        const services = await item.services();
        await writeDateTimestamp(item);
        if (services?.length > 0) {
          services.map(async (service: Service) => {
            const characteristics = await manager.characteristicsForDevice(
              item.id,
              service.uuid,
            );
            if (characteristics?.length > 0) {
              characteristics.map(async char => {
                setLoading(false);
                if (!char.isNotifiable) return;
                char.monitor((error, characteristic) => {
                  if (!characteristic?.uuid) return;
                  const buffer = Buffer.from(characteristic?.value, 'base64');
                  //shower records
                  if (char.uuid === 'e6221603-e12f-40f2-b0f5-aaa011c0aa8d') {
                    const values = decodeShowerRecordsArray(buffer);
                    setShowerRecords(state => {
                      return [...state, values];
                    });
                    return;
                  }
                  //data of completed shower
                  if (char.uuid === 'e622140a-e12f-40f2-b0f5-aaa011c0aa8d') {
                    const values = decodeShowerRecordsArray(buffer);
                    setCompletedShowerData(values);
                    return;
                  }
                  if (CHAR_DATA?.[char.uuid]?.bytes === 2)
                    return setPeripheralsValues(
                      map =>
                        new Map(
                          map.set(characteristic?.uuid, {
                            uuid: characteristic?.uuid,
                            value: buffer.readUInt16LE(0),
                          }),
                        ),
                    );
                  setPeripheralsValues(
                    map =>
                      new Map(
                        map.set(characteristic?.uuid, {
                          uuid: characteristic?.uuid,
                          value: buffer.readUInt32LE(0),
                        }),
                      ),
                  );
                });
              });
            }
          });
        }
      } catch (error) {
        setLoading(false);
        manager.cancelTransaction('monitor_characteristics_updates');
        setPeripheralsValues(new Map());
        scan();
        console.error(
          `[togglePeripheralConnection][${item.id}] error when trying to connect to device.`,
          error,
        );
      }
    }
  };

  return {
    isLoadingServicesData: loading,
    isScanActive: scanActive,
    peripherals,
    peripheralsValues,
    showerRecords,
    completedShowerData,
    isLoadingShowerRecords: loadingShowerRecords,
    isDeviceConnected: [...peripherals?.values()]?.find(
      item => item?.connected,
    ),
    togglePeripheralConnection,
    getShowersHistory,
    scan,
    stopScan,
  };
};

export default useBLE;

async function writeDateTimestamp(device: Device) {
  const now = new Date();
  const secondsSinceEpoch = Math.round(now.getTime() / 1000);
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32LE(+('0x' + secondsSinceEpoch.toString(16)), 0);

  const base64Value = buf.toString('base64');
  await manager.writeCharacteristicWithResponseForDevice(
    device.id,
    'e6221500-e12f-40f2-b0f5-aaa011c0aa8d',
    'e6221504-e12f-40f2-b0f5-aaa011c0aa8d',
    base64Value,
  );
}

function decodeShowerRecordsArray(uint8Array: Uint8Array) {
  let finalValues: ShowerRecords = {};
  // split into six arrays of specified lengths
  let offset = 0;
  finalValues = {
    ...finalValues,
    showerID: Buffer.from(uint8Array.slice(offset, offset + 4)).readUInt32LE(0),
  };
  offset += 4;
  finalValues = {
    ...finalValues,
    avgTemp: Buffer.from(uint8Array.slice(offset, offset + 2)).readUInt16LE(0),
  };
  offset += 2;
  finalValues = {
    ...finalValues,
    duration: Buffer.from(uint8Array.slice(offset, offset + 2)).readUInt16LE(0),
  };
  offset += 2;
  finalValues = {
    ...finalValues,
    waterConsumed: Buffer.from(
      uint8Array.slice(offset, offset + 4),
    ).readUInt32LE(0),
  };
  offset += 4;
  finalValues = {
    ...finalValues,
    timestamp: Buffer.from(uint8Array.slice(offset, offset + 4)).readUInt32LE(
      0,
    ),
  };
  offset += 4;
  finalValues = {
    ...finalValues,
    initialTemp: Buffer.from(uint8Array.slice(offset, offset + 2)).readUInt16LE(
      0,
    ),
  };

  return finalValues;
}
