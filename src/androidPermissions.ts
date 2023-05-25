import {PermissionsAndroid, Platform} from 'react-native';

export const handleAndroidPermissions = () => {
  if (Platform.OS === 'android') {
    PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]).then(result => {
      if (result) {
        console.debug(
          '[handleAndroidPermissions] User accepts bluetooth permissions',
        );
      } else {
        console.error(
          '[handleAndroidPermissions] User refuses bluetooth permissions',
        );
      }
    });
  }
};

export async function requestLocationPermission() {
  if (Platform.OS === 'android') {
    PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ).then(result => {
      if (result) {
        console.debug(
          '[handleAndroidPermissions] User accepts location permissions',
        );
      } else {
        console.error(
          '[handleAndroidPermissions] User refuses location permissions',
        );
      }
    });
  }
}
