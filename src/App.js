import React, { useEffect, useState } from 'react';
import './App.css';
import { initMap } from '@dstanesc/shared-property-map';
import { partReport } from '@dstanesc/fake-metrology-data'

import { pack } from 'msgpackr';
import * as lz4 from 'lz4js'
import * as pako from 'pako'

import { bufferToString, stringToBuffer } from "@fluidframework/common-utils";
import { layout, trace } from './plot';

function App() {

  // local view

  const [localValue, setLocalValue] = useState();

  const [sharedPropertyMap, setSharedPropertyMap] = useState();

  // remote view

  const [remoteValue, setRemoteValue] = useState();

  const [remotePropertyMap, setRemotePropertyMap] = useState();

  // timing

  const [startTimes, setStartTimes] = useState(new Map());

  const [endTimes, setEndTimes] = useState(new Map());

  const [sizes, setSizes] = useState(new Map());

  const [origSizes, setOrigSizes] = useState(new Map());

  const [durations, setDurations] = useState(new Map());

  const mapId = window.location.hash.substring(1) || undefined;

  useEffect(() => {
    async function init() {
      const sharedMap = await initMap(
        mapId,
        updateLocalModel,
        updateLocalModel,
        deleteLocalModel
      );
      if (mapId === undefined) {
        window.location.hash = sharedMap.mapId();
        //sharedMap.set("keyZero", "abc");
        //sharedMap.commit();
      }
      setSharedPropertyMap(sharedMap);
      return sharedMap.mapId();
    }

    init().then(localId => {
      const remoteView = initMap(
        localId,
        updateRemoteModel,
        updateRemoteModel,
        deleteRemoteModel
      );
      setRemotePropertyMap(remoteView);
    });

  }, []);

  useEffect(() => {
    const traces = []
    durations.forEach((value, key) => {
      const what = key.split("-");
      const lib = what[1];
      const count = what[0];
      const bytes = sizes.get(key);
      const origBytes = origSizes.get(key);
      const duration = value;
      const t = trace({ lib, count, bytes, origBytes, values: [bytes, duration], text: [`Compressed ${bytes} MiB, Original ${origBytes} MiB`, `Compressed ${bytes} MiB, Original ${origBytes} MiB, Speed ${duration} ms`] });
      traces.push(t);
    });
    Plotly.newPlot('plotDiv', traces, layout());
  }, [durations]);

  useEffect(() => {
    const times = new Map();
    endTimes.forEach((endTime, key) => {
      const startTime = startTimes.get(key);
      const duration = endTime - startTime;
      console.log(`Setting durration for key ${key}, value=${duration}`);
      times.set(key, duration)
    });
    setDurations(times);
  }, [endTimes]);


  const updateLocalModel = (key, value) => {
    console.log(`Updating local model ${key} -> big value`);
    //setLocalValue(key);
  };

  const deleteLocalModel = (key) => {
    console.log(`Deleting local model ${key}`);
  };

  const updateRemoteModel = (key, value) => {
    const d = new Date();
    const localTime = d.getTime();
    console.log(`Updating endTime=${localTime} remote model ${key} -> big value`);
    setEndTimes(new Map(endTimes.set(key, localTime)));
    //setRemoteValue(key);
    const len = miB((new TextEncoder().encode(value)).length);
    setSizes(new Map(sizes.set(key, len)));
  };

  const deleteRemoteModel = (key) => {
    console.log(`Deleting remote model ${key}`);
  };

  const roll = async () => {
    if (sharedPropertyMap) {
      const json50 = partReport({ reportSize: 50 });
      const json100 = partReport({ reportSize: 100 });
      const json300 = partReport({ reportSize: 300 });
      const json600 = partReport({ reportSize: 600 });
      //const json800 = partReport({ reportSize: 800 });

      await execRoll(rollJson, 50, json50);
      await execRoll(rollPako, 50, json50);
      await execRoll(rollLz4, 50, json50);
      await execRoll(rollJson, 100, json100);
      await execRoll(rollPako, 100, json100);
      await execRoll(rollLz4, 100, json100);
      await execRoll(rollPako, 300, json300);
      await execRoll(rollLz4, 300, json300);
      await execRoll(rollPako, 600, json600);
      await execRoll(rollLz4, 600, json600);
    } else {
      alert("Please wait to initialize")
    }
  }


  const execRoll = (fn, size, json) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        fn(size, json);
        resolve();
      }, 1 * 1000);
    });
  }

  const rollJson = (size, json) => {
    const jsonText = JSON.stringify(json);
    const d = new Date();
    const localTime = d.getTime();
    const key = size + "-json";
    const newStartTimes = startTimes.set(key, localTime);
    setStartTimes(new Map(newStartTimes));
    const origSize = miB(new TextEncoder().encode(jsonText).length);
    const newOrigSizes = origSizes.set(key, origSize);
    setOrigSizes(new Map(newOrigSizes));
    sharedPropertyMap.set(key, jsonText);
    sharedPropertyMap.commit();
    console.log(`rollJson startTime=${localTime}`);
  };

  const rollPako = (size, json) => {
    const d = new Date();
    const localTime = d.getTime();
    const key = size + "-pako";
    const newStartTimes = startTimes.set(key, localTime);
    setStartTimes(new Map(newStartTimes));
    const buf = pack(json);
    const origSize = miB(buf.length);
    const newOrigSizes = origSizes.set(key, origSize);
    setOrigSizes(new Map(newOrigSizes));
    const ser = pako.deflate(buf);
    const b64 = bufferToString(ser, "base64");
    sharedPropertyMap.set(key, b64);
    sharedPropertyMap.commit();
    console.log(`rollPako startTime=${localTime} `);
  };

  const rollLz4 = (size, json) => {
    const d = new Date();
    const localTime = d.getTime();
    const key = size + "-lz4";
    const newStartTimes = startTimes.set(key, localTime);
    setStartTimes(new Map(newStartTimes));
    const buf = pack(json);
    const origSize = miB(buf.length);
    const newOrigSizes = origSizes.set(key, origSize);
    setOrigSizes(new Map(newOrigSizes));
    const ser = lz4.compress(buf);
    const b64 = bufferToString(ser, "base64");
    sharedPropertyMap.set(key, b64);
    sharedPropertyMap.commit();
    console.log(`rollLz4 startTime=${localTime}`);
  };

  const encoder = new TextEncoder()

  const rate = (origSize, deflatedSize) => {
    return (((origSize - deflatedSize) / origSize) * 100).toFixed(2);
  }

  const miB = (size) => {
    return (size / (1024 * 1024)).toFixed(2);
  }

  return (
    <div className="App">
      <div className="remote" onClick={() => roll()}>
        [Start e2e]
      </div>
      <div id='plotDiv'></div>
    </div>
  );
}

export default App;
