import React, { useRef, useEffect, useState } from 'react';
import { View, TextInput, PanResponder, Animated } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import tinycolor from 'tinycolor2';

const WIDTH = 300;
const HEIGHT = 200;
const SLIDER_HEIGHT = 30;

export default function MyColorPicker({
  color,
  onColorChange,
}: {
  color: string;
  onColorChange: (hex: string) => void;
}) {
  const [hue, setHue] = useState(0);
  const [hex, setHex] = useState(color);

  const satX = useRef(new Animated.Value(0)).current;
  const lightY = useRef(new Animated.Value(0)).current;
  const hueX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (tinycolor(color).isValid()) {
      const hsl = tinycolor(color).toHsl();
      setHue(hsl.h);
      hueX.setValue((hsl.h / 360) * WIDTH);
      satX.setValue(hsl.s * WIDTH);
      lightY.setValue(HEIGHT - hsl.l * HEIGHT);
      setHex(tinycolor(color).toHexString());
    }
  }, [color]);

  const handleSatLightChange = (x: number, y: number) => {
    const clampedX = Math.max(0, Math.min(x, WIDTH));
    const clampedY = Math.max(0, Math.min(y, HEIGHT));
  
    Animated.timing(satX, {
      toValue: clampedX,
      duration: 50,
      useNativeDriver: false,
    }).start();
  
    Animated.timing(lightY, {
      toValue: clampedY,
      duration: 50,
      useNativeDriver: false,
    }).start();
  
    const s = (clampedX / WIDTH) * 100;
    const l = 100 - (clampedY / HEIGHT) * 100;
    const newColor = tinycolor({ h: hue, s, l }).toHexString();
    setHex(newColor);
    onColorChange(newColor);
  };
  

  const handleHueChange = (x: number) => {
    const clampedX = Math.max(0, Math.min(x, WIDTH));
    Animated.timing(hueX, {
      toValue: clampedX,
      duration: 50,
      useNativeDriver: false,
    }).start();
  
    const hueValue = (clampedX / WIDTH) * 360;
    setHue(hueValue);
  };

  const updateColor = (x: number, y: number) => {
    const s = (x / WIDTH) * 100;
    const l = 100 - (y / HEIGHT) * 100;
    const newColor = tinycolor({ h: hue, s, l }).toHexString();
    setHex(newColor);
    onColorChange(newColor);
  };
  
  

  const satLightPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        satX.setValue(locationX);
        lightY.setValue(locationY);
        updateColor(locationX, locationY);
      },      
      onPanResponderMove: (_, gestureState) => {
        const x = Math.max(0, Math.min(WIDTH, gestureState.moveX));
        const y = Math.max(0, Math.min(HEIGHT, gestureState.moveY));
        satX.setValue(x);
        lightY.setValue(y);
        updateColor(x, y);
      },
      
    })
  ).current;
  
  

  const huePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gestureState) => {
        const x = Math.max(0, Math.min(WIDTH, gestureState.x0));
        handleHueChange(x);
      },
      onPanResponderMove: (_, gestureState) => {
        const x = Math.max(0, Math.min(WIDTH, gestureState.moveX));
        handleHueChange(x);
      },
    })
  ).current;

  return (
    <View style={{ alignItems: 'center', marginVertical: 16 }}>
      {/* Saturation-Lightness Area */}
      <View {...satLightPan.panHandlers} style={{ width: WIDTH, height: HEIGHT }}>
        <Svg width={WIDTH} height={HEIGHT}>
          <Defs>
            <LinearGradient id="sat" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="#fff" />
              <Stop offset="100%" stopColor={`hsl(${hue}, 100%, 50%)`} />
            </LinearGradient>
            <LinearGradient id="light" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="black" stopOpacity="0" />
              <Stop offset="100%" stopColor="black" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#sat)" />
          <Rect width="100%" height="100%" fill="url(#light)" />
        </Svg>
        <Animated.View
  style={{
    position: 'absolute',
    transform: [
      { translateX: Animated.subtract(satX, 10) },
      { translateY: Animated.subtract(lightY, 10) },
    ],
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'white',
    backgroundColor: hex, // Optional: live preview
  }}
/>

      </View>

      {/* Hue Slider */}
      <View {...huePan.panHandlers} style={{ marginTop: 12 }}>
        <Svg width={WIDTH} height={SLIDER_HEIGHT}>
          <Defs>
            <LinearGradient id="hue" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="#f00" />
              <Stop offset="17%" stopColor="#ff0" />
              <Stop offset="33%" stopColor="#0f0" />
              <Stop offset="50%" stopColor="#0ff" />
              <Stop offset="67%" stopColor="#00f" />
              <Stop offset="83%" stopColor="#f0f" />
              <Stop offset="100%" stopColor="#f00" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#hue)" />
        </Svg>
        <Animated.View
          style={{
            position: 'absolute',
            top: SLIDER_HEIGHT / 2 - 10,
            left: Animated.subtract(hueX, 10),
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: 'white',
            backgroundColor: `hsl(${hue}, 100%, 50%)`, // use hue from state
          }}
        />
      </View>

      {/* Hex Input */}
      <TextInput
        value={hex}
        onChangeText={(value) => {
          setHex(value);
          if (tinycolor(value).isValid()) {
            onColorChange(tinycolor(value).toHexString());
          }
        }}
        style={{
          marginTop: 12,
          borderColor: '#ccc',
          borderWidth: 1,
          padding: 8,
          width: 120,
          textAlign: 'center',
          fontSize: 16,
        }}
        placeholder="#ff0000"
        autoCapitalize="none"
      />
    </View>
  );
}