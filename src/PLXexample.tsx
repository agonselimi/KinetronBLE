import React, {useState} from 'react';
import {
  ActivityIndicator,
  Button,
  FlatList,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import moment from 'moment';
import {Device} from 'react-native-ble-plx';
import useBLE from './useBLE';
import CHAR_DATA from '../model/kss_serv_char.json';
import {PeripheralType, ShowerRecords} from './types';

const showerHistoryEnums = [
  'Shower ID',
  'Average temperature',
  'Duration',
  'Water Consumed',
  'Timestamp',
  'Initial temperature',
];

const PLXexample = () => {
  const [selectedTab, setSelectedTab] = useState('DEVICES');
  const {
    isLoadingServicesData,
    isScanActive,
    peripherals,
    peripheralsValues,
    showerRecords,
    completedShowerData,
    isLoadingShowerRecords,
    isDeviceConnected,
    togglePeripheralConnection,
    getShowersHistory,
    scan,
    stopScan,
  } = useBLE();

  const renderItem = (item: PeripheralType) => {
    if (isDeviceConnected && !item?.connected) return;
    const backgroundColor = item?.connected ? '#069400' : 'white';
    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => togglePeripheralConnection(item)}>
        <View style={[styles.row, {backgroundColor}]}>
          <Text style={styles.peripheralName}>
            {item.name}
            {item?.connecting && ' - Connecting...'}
          </Text>
          <Text style={styles.rssi}>RSSI: {item.rssi}</Text>
          <Text style={styles.peripheralId}>{item.id}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderValuesItem = (item: {uuid: string; value: number}) => {
    const characteristic = CHAR_DATA[item.uuid];
    const name = characteristic?.name;
    const unit =
      characteristic?.data?.unit !== 'none' ? characteristic?.data?.unit : '';
    const getItemValue = () => {
      if (item.uuid === 'e6221407-e12f-40f2-b0f5-aaa011c0aa8d') {
        return moment.unix(item.value).format('MMMM Do, YYYY h:mm:ss A');
      }
      switch (unit) {
        case 'Celcius':
          return (Number(item.value) / 100).toFixed(2);
        case '':
          return item.value;
        case 'sec':
          return moment.utc(Number(item.value) * 1000).format('HH:mm:ss');
        default:
          return (Number(item.value) / 1000).toFixed(3);
      }
    };
    return (
      <Text key={item.uuid} style={styles.renderValuesItem}>
        {name}: {getItemValue()} {unit}
      </Text>
    );
  };

  const renderShowerRecords = ({item}: {item: ShowerRecords}) => {
    return (
      <View style={styles.showerRecordsItem}>
        <Text style={styles.renderShowerRecordsItem}>
          {showerHistoryEnums[0]}: {item.showerID}
          {'\n'}
          {showerHistoryEnums[1]}: {(Number(item.avgTemp) / 100).toFixed(2)}{' '}
          Celcius
          {'\n'}
          {showerHistoryEnums[2]}:{' '}
          {moment.utc(Number(item.duration) * 1000).format('HH:mm:ss')}
          {'\n'}
          {showerHistoryEnums[3]}:{' '}
          {(Number(item.waterConsumed) / 1000).toFixed(2)} l{'\n'}
          {showerHistoryEnums[4]}:{' '}
          {moment.unix(item.timestamp).format('MMMM Do, YYYY h:mm:ss A')}
          {'\n'}
          {showerHistoryEnums[5]}: {(Number(item.initialTemp) / 100).toFixed(2)}{' '}
          Celcius
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.ctn}>
      <StatusBar barStyle={'dark-content'} />
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[
            styles.topButtonCtn,
            selectedTab === 'DEVICES' && {borderBottomWidth: 1},
          ]}
          onPress={() => setSelectedTab('DEVICES')}>
          <Text
            style={[
              styles.topButtonText,
              selectedTab === 'DEVICES' && {fontWeight: '500'},
            ]}>
            DEVICES
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.topButtonCtn,
            selectedTab === 'HISTORY' && {borderBottomWidth: 1},
          ]}
          disabled={!isDeviceConnected && !isLoadingServicesData}
          onPress={() => setSelectedTab('HISTORY')}>
          <Text
            style={[
              styles.topButtonText,
              selectedTab === 'HISTORY' && {fontWeight: '500'},
              !isDeviceConnected && !isLoadingServicesData && {opacity: 0.2},
            ]}>
            HISTORY
          </Text>
        </TouchableOpacity>
      </View>
      {selectedTab === 'DEVICES' && (
        <ScrollView>
          <View style={styles.scanButtonCtn}>
            <Button
              title={!isScanActive ? 'SCAN FOR DEVICES' : 'STOP SCAN'}
              onPress={!isScanActive ? scan : stopScan}
            />
          </View>
          {peripherals?.size !== 0 ? (
            <>
              <Text style={[styles.center, {marginBottom: 10}]}>
                {isDeviceConnected ? 'Connected Decvice' : 'Founded Devices:'}
              </Text>
              {Array.from(peripherals.values())?.map(renderItem)}
            </>
          ) : null}
          {isLoadingServicesData ? (
            <View style={styles.loader}>
              <ActivityIndicator size="small" />
              <Text style={styles.loadingShowerRecordsText}>
                Fetching data from the sensor..
              </Text>
            </View>
          ) : null}
          {peripheralsValues?.size !== 0 ? (
            <View style={styles.showerRecordsItem}>
              <Text style={styles.cardText}>Real time values:</Text>
              {Array.from(peripheralsValues?.values())?.map(renderValuesItem)}
            </View>
          ) : null}
          {completedShowerData && (
            <View>
              <Text style={styles.completedShowerDataText}>
                Completed shower data
              </Text>
              {renderShowerRecords({item: completedShowerData})}
            </View>
          )}
        </ScrollView>
      )}
      {selectedTab === 'HISTORY' && (
        <View>
          <View style={styles.scanButtonCtn}>
            <Button
              title="GET SHOWER RECORDS HISTORY"
              onPress={() => getShowersHistory()}
              disabled={isLoadingShowerRecords}
            />
          </View>
          {isLoadingShowerRecords ? (
            <View style={styles.loader}>
              <ActivityIndicator size="small" />
              <Text style={styles.loadingShowerRecordsText}>
                Loading shower records..
              </Text>
            </View>
          ) : null}
          {showerRecords?.length > 0 ? (
            <FlatList
              data={showerRecords}
              ListHeaderComponent={
                <Text style={styles.center}>Shower Records:</Text>
              }
              renderItem={renderShowerRecords}
              keyExtractor={item => String(item.showerID)}
              contentContainerStyle={{flexGrow: 1, paddingBottom: 150}}
            />
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  ctn: {backgroundColor: 'white', flex: 1},
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
  peripheralName: {
    fontSize: 16,
    textAlign: 'center',
    padding: 10,
  },
  rssi: {
    fontSize: 12,
    textAlign: 'center',
    padding: 2,
  },
  peripheralId: {
    fontSize: 12,
    textAlign: 'center',
    padding: 2,
    paddingBottom: 20,
  },
  row: {
    marginLeft: 10,
    marginRight: 10,
    borderRadius: 20,
  },
  noPeripherals: {
    margin: 10,
    textAlign: 'center',
    color: 'white',
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  topButtonCtn: {
    width: '50%',
    alignItems: 'center',
    padding: 10,
  },
  topButtonText: {
    fontSize: 16,
  },
  scanButtonCtn: {
    paddingVertical: 15,
  },
  showerRecordsItem: {
    marginHorizontal: 15,
    borderRadius: 10,
    padding: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.22,
    shadowRadius: 4,
    backgroundColor: 'white',
    marginTop: 20,
  },
  loader: {alignItems: 'center', paddingVertical: 20},
  center: {alignSelf: 'center'},
  loadingShowerRecordsText: {marginTop: 10},
  cardText: {marginBottom: 20},
  completedShowerDataText: {marginTop: 20, marginLeft: 15, fontWeight: 'bold'},
  renderValuesItem: {
    color: 'red',
    fontWeight: '700',
    fontSize: 14,
    marginVertical: 5,
  },
  renderShowerRecordsItem: {color: 'red', fontWeight: '700', fontSize: 14},
});

export default PLXexample;
